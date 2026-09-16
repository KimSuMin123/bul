import React, { createContext, useContext, useState, useEffect } from 'react';
import { getStored, setStored, STORAGE_KEYS, initStorage } from '../services/storage';
import { generateMemberNumber } from '../services/certService';
import { remoteDb, isExternalDbConfigured } from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionConflict, setSessionConflict] = useState(false);

  useEffect(() => {
    initStorage();

    // Sync users from Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.getUsers().then(remoteUsers => {
        if (remoteUsers && remoteUsers.length > 0) {
          const localUsers = getStored(STORAGE_KEYS.USERS) || [];
          // Merge remote users with local, remote takes precedence
          const merged = [...remoteUsers];
          localUsers.forEach(lu => {
            if (!merged.some(mu => mu.id === lu.id)) {
              merged.push(lu);
            }
          });
          setStored(STORAGE_KEYS.USERS, merged);
        }
      }).catch(e => console.warn('Supabase users sync warning:', e));
    }

    const storedUser = getStored(STORAGE_KEYS.CURRENT_USER);
    if (storedUser) {
      // Validate user still exists
      const users = getStored(STORAGE_KEYS.USERS) || [];
      const matched = users.find(u => u.id === storedUser.id);
      if (matched) {
        setCurrentUser({ ...matched, activeSessionToken: storedUser.activeSessionToken });
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    }
    setLoading(false);

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
  }, []);

  // Check ID availability
  const checkIdAvailable = (id) => {
    const users = getStored(STORAGE_KEYS.USERS) || [];
    return !users.some(u => u.id.toLowerCase() === id.trim().toLowerCase());
  };

  // Check Phone availability (prevent duplicate sign up)
  const checkPhoneAvailable = (phone) => {
    const users = getStored(STORAGE_KEYS.USERS) || [];
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return !users.some(u => u.phone.replace(/[^0-9]/g, '') === cleanPhone);
  };

  // Register New Member
  const register = ({ id, password, name, birthDate, phone }) => {
    // Validation
    const cleanId = id.trim();
    if (!cleanId) throw new Error('아이디를 입력해 주세요.');
    if (!checkIdAvailable(cleanId)) throw new Error('이미 사용 중인 아이디입니다.');

    // Password validation: 8+ chars, must include letters, numbers, and special symbols
    const hasLetters = /[A-Za-z]/.test(password || '');
    const hasNumbers = /\d/.test(password || '');
    const hasSpecial = /[@$!%*#?&~^_\-+=\[\]{}();:'",.<>\/\\|`~]/.test(password || '');

    if (!password || password.length < 8 || !hasLetters || !hasNumbers || !hasSpecial) {
      throw new Error('비밀번호는 영문, 숫자, 기호를 모두 포함하여 8자 이상이어야 합니다.');
    }

    if (!name.trim()) throw new Error('이름을 입력해 주세요.');
    if (!birthDate) throw new Error('생년월일을 선택해 주세요.');

    const cleanPhone = phone.trim();
    if (!checkPhoneAvailable(cleanPhone)) {
      throw new Error('해당 휴대전화 번호로 이미 가입된 계정이 존재합니다. (1인 1계정 원칙)');
    }

    const memberNo = generateMemberNumber();
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

    const users = getStored(STORAGE_KEYS.USERS) || [];
    users.push(newUser);
    setStored(STORAGE_KEYS.USERS, users);

    // Sync to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.insertUser(newUser).catch(err => console.warn('Remote insertUser error:', err));
    }

    return newUser;
  };

  // Login
  const login = (id, password) => {
    const users = getStored(STORAGE_KEYS.USERS) || [];
    const user = users.find(u => u.id === id.trim() && u.password === password);
    if (!user) {
      throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');
    }

    // Generate unique session token for single device restriction
    const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const sessionUser = { ...user, activeSessionToken: sessionToken };

    // Update in users store
    const updatedUsers = users.map(u => u.id === user.id ? { ...u, activeSessionToken: sessionToken } : u);
    setStored(STORAGE_KEYS.USERS, updatedUsers);
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

  // Logout
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  };

  // Find / Reset Password
  const resetPassword = ({ id, name, phone, newPassword }) => {
    const users = getStored(STORAGE_KEYS.USERS) || [];
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const userIndex = users.findIndex(
      u => u.id === id.trim() && u.name.trim() === name.trim() && u.phone.replace(/[^0-9]/g, '') === cleanPhone
    );

    if (userIndex === -1) {
      throw new Error('입력하신 회원 정보와 일치하는 계정을 찾을 수 없습니다.');
    }

    const hasLetters = /[A-Za-z]/.test(newPassword || '');
    const hasNumbers = /\d/.test(newPassword || '');
    const hasSpecial = /[@$!%*#?&~^_\-+=\[\]{}();:'",.<>\/\\|`~]/.test(newPassword || '');

    if (!newPassword || newPassword.length < 8 || !hasLetters || !hasNumbers || !hasSpecial) {
      throw new Error('새 비밀번호는 영문, 숫자, 기호를 모두 포함하여 8자 이상이어야 합니다.');
    }

    users[userIndex].password = newPassword;
    setStored(STORAGE_KEYS.USERS, users);

    // Sync to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.updateUserPassword(users[userIndex].id, newPassword).catch(err => console.warn('Remote updateUserPassword error:', err));
    }

    return true;
  };

  // Admin: Arbitrarily register user (Student or Admin)
  const adminRegisterUser = ({ id, password, name, birthDate, phone, role = 'student', memberNo }) => {
    const cleanId = id?.trim();
    if (!cleanId) throw new Error('아이디를 입력해 주세요.');
    if (!checkIdAvailable(cleanId)) throw new Error('이미 등록되어 사용 중인 아이디입니다.');

    if (!password || password.trim().length < 4) {
      throw new Error('비밀번호는 최소 4자 이상이어야 합니다.');
    }

    if (!name || !name.trim()) throw new Error('이름(또는 법명)을 입력해 주세요.');
    if (!birthDate) throw new Error('생년월일을 선택해 주세요.');

    const cleanPhone = phone?.trim();
    if (!cleanPhone) throw new Error('휴대전화 번호를 입력해 주세요.');
    if (!checkPhoneAvailable(cleanPhone)) {
      throw new Error('해당 휴대전화 번호로 이미 가입된 계정이 존재합니다. (1인 1계정 원칙)');
    }

    const assignedMemberNo = memberNo?.trim() || generateMemberNumber();
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

    const users = getStored(STORAGE_KEYS.USERS) || [];
    users.push(newUser);
    setStored(STORAGE_KEYS.USERS, users);

    // Sync to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.insertUser(newUser).catch(err => console.warn('Remote insertUser error:', err));
    }

    return newUser;
  };

  // Admin: Delete user and clean related data
  const adminDeleteUser = (userId) => {
    if (userId === 'admin') {
      throw new Error('최고관리자(admin) 계정은 안전을 위해 삭제할 수 없습니다.');
    }
    if (currentUser && currentUser.id === userId) {
      throw new Error('현재 로그인 중인 본인 관리자 계정은 삭제할 수 없습니다.');
    }

    const users = getStored(STORAGE_KEYS.USERS) || [];
    const exists = users.some(u => u.id === userId);
    if (!exists) throw new Error('존재하지 않는 회원입니다.');

    // 1. Remove from local users
    const updatedUsers = users.filter(u => u.id !== userId);
    setStored(STORAGE_KEYS.USERS, updatedUsers);

    // 2. Cascade delete enrollments, payments, progress, certificates locally
    const enrollments = getStored(STORAGE_KEYS.ENROLLMENTS) || [];
    setStored(STORAGE_KEYS.ENROLLMENTS, enrollments.filter(e => e.userId !== userId));

    const payments = getStored(STORAGE_KEYS.PAYMENTS) || [];
    setStored(STORAGE_KEYS.PAYMENTS, payments.filter(p => p.userId !== userId));

    const progress = getStored(STORAGE_KEYS.PROGRESS) || [];
    setStored(STORAGE_KEYS.PROGRESS, progress.filter(pr => pr.userId !== userId));

    const certs = getStored(STORAGE_KEYS.CERTIFICATES) || [];
    setStored(STORAGE_KEYS.CERTIFICATES, certs.filter(c => c.userId !== userId));

    // 3. Sync to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.deleteUser(userId).catch(err => console.warn('Remote deleteUser error:', err));
    }

    return true;
  };

  // Admin: Directly reset any user password
  const adminResetPassword = (userId, newPassword) => {
    if (!newPassword || newPassword.trim().length < 4) {
      throw new Error('새 비밀번호는 최소 4자 이상이어야 합니다.');
    }

    const users = getStored(STORAGE_KEYS.USERS) || [];
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) {
      throw new Error('회원을 찾을 수 없습니다.');
    }

    users[idx].password = newPassword.trim();
    setStored(STORAGE_KEYS.USERS, users);

    // Sync to Supabase Cloud DB
    if (isExternalDbConfigured) {
      remoteDb.updateUserPassword(userId, newPassword.trim()).catch(err => console.warn('Remote updateUserPassword error:', err));
    }

    return true;
  };

  const clearConflictAlert = () => {
    setSessionConflict(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        sessionConflict,
        clearConflictAlert,
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
