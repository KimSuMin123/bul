import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStored, setStored, STORAGE_KEYS, initStorage } from '../services/storage';
import { generateMemberNumber } from '../services/certService';
import { remoteDb, isExternalDbConfigured } from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionConflict, setSessionConflict] = useState(false);

  // Fetch users from Supabase Cloud DB
  const refreshUsers = useCallback(async () => {
    if (!isExternalDbConfigured) return [];
    try {
      const remoteUsers = await remoteDb.getUsers();
      if (Array.isArray(remoteUsers)) {
        setUsers(remoteUsers);
        return remoteUsers;
      }
    } catch (e) {
      console.warn('Supabase users fetch warning:', e);
    }
    return [];
  }, []);

  useEffect(() => {
    // 1. Purge legacy local database tables (keep only current user session ticket)
    initStorage();

    // 2. Load latest users from Supabase and validate current session
    async function initAuth() {
      try {
        const remoteUsers = await refreshUsers();
        const storedUser = getStored(STORAGE_KEYS.CURRENT_USER);

        if (storedUser && Array.isArray(remoteUsers)) {
          const matched = remoteUsers.find(u => u.id === storedUser.id);
          if (matched) {
            // Restore session with latest profile from Supabase
            setCurrentUser({ ...matched, activeSessionToken: storedUser.activeSessionToken });
          } else {
            // User no longer exists in Supabase, clear session ticket
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            setCurrentUser(null);
          }
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    // Single device / Concurrent login detection via BroadcastChannel
    let authChannel;
    try {
      authChannel = new BroadcastChannel('buddha_auth_session_channel');
      authChannel.onmessage = (event) => {
        const { type, userId, sessionToken } = event.data;
        if (type === 'NEW_LOGIN') {
          const activeUser = getStored(STORAGE_KEYS.CURRENT_USER);
          if (activeUser && activeUser.id === userId && activeUser.activeSessionToken !== sessionToken) {
            setSessionConflict(true);
            // Invalidate current session
            setCurrentUser(null);
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
          }
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported', e);
    }

    return () => {
      if (authChannel) authChannel.close();
    };
  }, [refreshUsers]);

  // Check ID availability
  const checkIdAvailable = (id) => {
    return !users.some(u => u.id.toLowerCase() === id.trim().toLowerCase());
  };

  // Check Phone availability (prevent duplicate sign up)
  const checkPhoneAvailable = (phone) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return !users.some(u => u.phone && u.phone.replace(/[^0-9]/g, '') === cleanPhone);
  };

  // Register New Member (100% Supabase Direct)
  const register = async ({ id, password, name, birthDate, phone }) => {
    const cleanId = id.trim();
    if (!cleanId) throw new Error('아이디를 입력해 주세요.');

    // Ensure latest users loaded
    const latestUsers = (await refreshUsers()) || users;
    if (latestUsers.some(u => u.id.toLowerCase() === cleanId.toLowerCase())) {
      throw new Error('이미 사용 중인 아이디입니다.');
    }

    // Password validation: 8+ chars, letters, numbers, special symbols
    const hasLetters = /[A-Za-z]/.test(password || '');
    const hasNumbers = /\d/.test(password || '');
    const hasSpecial = /[@$!%*#?&~^_\-+=\[\]{}();:'",.<>\/\\|`~]/.test(password || '');

    if (!password || password.length < 8 || !hasLetters || !hasNumbers || !hasSpecial) {
      throw new Error('비밀번호는 영문, 숫자, 기호를 모두 포함하여 8자 이상이어야 합니다.');
    }

    if (!name.trim()) throw new Error('이름을 입력해 주세요.');
    if (!birthDate) throw new Error('생년월일을 선택해 주세요.');

    const cleanPhone = phone.trim();
    if (latestUsers.some(u => u.phone && u.phone.replace(/[^0-9]/g, '') === cleanPhone.replace(/[^0-9]/g, ''))) {
      throw new Error('해당 휴대전화 번호로 이미 가입된 계정이 존재합니다. (1인 1계정 원칙)');
    }

    const memberNo = generateMemberNumber(latestUsers.length);
    const newUser = {
      id: cleanId,
      password,
      name: name.trim(),
      birthDate,
      phone: cleanPhone,
      memberNo,
      role: 'student',
      createdAt: new Date().toISOString().split('T')[0]
    };

    // Save directly to Supabase Cloud DB
    const res = await remoteDb.insertUser(newUser);
    if (!res && isExternalDbConfigured) {
      throw new Error('클라우드 데이터베이스에 회원 등록을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }

    await refreshUsers();
    return newUser;
  };

  // Login (100% Supabase Direct Authentication)
  const login = async (id, password) => {
    const cleanId = id.trim();
    const latestUsers = (await refreshUsers()) || users;
    const user = latestUsers.find(u => u.id.toLowerCase() === cleanId.toLowerCase() && u.password === password);

    if (!user) {
      throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');
    }

    // Generate unique session token for single device restriction
    const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const sessionUser = { ...user, activeSessionToken: sessionToken };

    // Store ONLY the session ticket in browser storage for refresh persistence
    setStored(STORAGE_KEYS.CURRENT_USER, sessionUser);
    setCurrentUser(sessionUser);
    setSessionConflict(false);

    // Broadcast new login to invalidate older sessions
    try {
      const channel = new BroadcastChannel('buddha_auth_session_channel');
      channel.postMessage({ type: 'NEW_LOGIN', userId: user.id, sessionToken });
      channel.close();
    } catch (e) {}

    return sessionUser;
  };

  // Logout (Clear session ticket)
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  };

  // Find / Reset Password (100% Supabase Direct)
  const resetPassword = async ({ id, name, phone, newPassword }) => {
    const cleanId = id.trim();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const latestUsers = (await refreshUsers()) || users;
    
    const user = latestUsers.find(
      u => u.id.toLowerCase() === cleanId.toLowerCase() && 
           u.name.trim() === name.trim() && 
           u.phone && u.phone.replace(/[^0-9]/g, '') === cleanPhone
    );

    if (!user) {
      throw new Error('입력하신 회원 정보와 일치하는 계정을 찾을 수 없습니다.');
    }

    const hasLetters = /[A-Za-z]/.test(newPassword || '');
    const hasNumbers = /\d/.test(newPassword || '');
    const hasSpecial = /[@$!%*#?&~^_\-+=\[\]{}();:'",.<>\/\\|`~]/.test(newPassword || '');

    if (!newPassword || newPassword.length < 8 || !hasLetters || !hasNumbers || !hasSpecial) {
      throw new Error('새 비밀번호는 영문, 숫자, 기호를 모두 포함하여 8자 이상이어야 합니다.');
    }

    await remoteDb.updateUserPassword(user.id, newPassword);
    await refreshUsers();
    return true;
  };

  // Admin: Arbitrarily register user (100% Supabase Direct)
  const adminRegisterUser = async ({ id, password, name, birthDate, phone, role = 'student', memberNo }) => {
    const cleanId = id?.trim();
    if (!cleanId) throw new Error('아이디를 입력해 주세요.');

    const latestUsers = (await refreshUsers()) || users;
    if (latestUsers.some(u => u.id.toLowerCase() === cleanId.toLowerCase())) {
      throw new Error('이미 등록되어 사용 중인 아이디입니다.');
    }

    if (!password || password.trim().length < 4) {
      throw new Error('비밀번호는 최소 4자 이상이어야 합니다.');
    }

    if (!name || !name.trim()) throw new Error('이름(또는 법명)을 입력해 주세요.');
    if (!birthDate) throw new Error('생년월일을 선택해 주세요.');

    const cleanPhone = phone?.trim();
    if (!cleanPhone) throw new Error('휴대전화 번호를 입력해 주세요.');
    if (latestUsers.some(u => u.phone && u.phone.replace(/[^0-9]/g, '') === cleanPhone.replace(/[^0-9]/g, ''))) {
      throw new Error('해당 휴대전화 번호로 이미 가입된 계정이 존재합니다. (1인 1계정 원칙)');
    }

    const assignedMemberNo = memberNo?.trim() || generateMemberNumber(latestUsers.length);
    const newUser = {
      id: cleanId,
      password: password.trim(),
      name: name.trim(),
      birthDate,
      phone: cleanPhone,
      memberNo: assignedMemberNo,
      role: role || 'student',
      createdAt: new Date().toISOString().split('T')[0]
    };

    await remoteDb.insertUser(newUser);
    await refreshUsers();
    return newUser;
  };

  // Admin: Delete user (100% Supabase Direct Cascade)
  const adminDeleteUser = async (userId) => {
    if (userId === 'admin') {
      throw new Error('최고관리자(admin) 계정은 안전을 위해 삭제할 수 없습니다.');
    }
    if (currentUser && currentUser.id === userId) {
      throw new Error('현재 로그인 중인 본인 관리자 계정은 삭제할 수 없습니다.');
    }

    await remoteDb.deleteUser(userId);
    await refreshUsers();
    return true;
  };

  // Admin: Reset any user password (100% Supabase Direct)
  const adminResetPassword = async (userId, newPassword) => {
    if (!newPassword || newPassword.trim().length < 4) {
      throw new Error('새 비밀번호는 최소 4자 이상이어야 합니다.');
    }

    await remoteDb.updateUserPassword(userId, newPassword.trim());
    await refreshUsers();
    return true;
  };

  const clearConflictAlert = () => {
    setSessionConflict(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        loading,
        sessionConflict,
        clearConflictAlert,
        refreshUsers,
        login,
        logout,
        register,
        adminRegisterUser,
        adminDeleteUser,
        adminResetPassword,
        checkIdAvailable,
        checkPhoneAvailable,
        resetPassword,
        isAdmin: currentUser?.role === 'admin'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
