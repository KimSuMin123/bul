import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { removeStored, STORAGE_KEYS, initStorage } from '../services/storage';
import { remoteDb } from '../services/apiClient';
import { clearAuthSession, getAuthSession, signOutSession } from '../services/authSession';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionConflict, setSessionConflict] = useState(false);
  const authVersion = useRef(0);
  const userRef = useRef(null);
  userRef.current = currentUser;

  const refreshUsers = useCallback(async () => {
    if (userRef.current?.role !== 'admin') return [];
    const version = authVersion.current;
    const rows = await remoteDb.getUsers();
    if (version === authVersion.current) setUsers(rows);
    return rows;
  }, []);

  useEffect(() => {
    initStorage();
    // Cached profile fields are never evidence of identity or administrator access.
    removeStored(STORAGE_KEYS.CURRENT_USER);
    const version = ++authVersion.current;
    remoteDb.getCurrentUser().then(user => {
      if (version !== authVersion.current) return;
      if (!user) clearAuthSession();
      setCurrentUser(user);
    }).catch(() => {
      if (version === authVersion.current) {
        clearAuthSession();
        setError('로그인 세션을 확인하지 못했습니다. 다시 로그인해 주세요.');
      }
    }).finally(() => { if (version === authVersion.current) setLoading(false); });
    const expired = () => {
      authVersion.current++;
      setCurrentUser(null);
      setUsers([]);
      setLoading(false);
      setError('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    };
    window.addEventListener('buddha_auth_expired', expired);
    return () => { authVersion.current++; window.removeEventListener('buddha_auth_expired', expired); };
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'admin') refreshUsers().catch(() => setError('회원 목록을 불러오지 못했습니다. 다시 시도해 주세요.'));
    else setUsers([]);
  }, [currentUser?.id, currentUser?.role, refreshUsers]);

  const login = async (id, password) => {
    const version = ++authVersion.current;
    const user = await remoteDb.authenticateUser(id.trim(), password);
    if (version !== authVersion.current) return null;
    setCurrentUser({ ...user, activeSessionToken: getAuthSession()?.access_token });
    setSessionConflict(false);
    setError(null);
    setLoading(false);
    return user;
  };

  const logout = () => {
    authVersion.current++;
    setCurrentUser(null);
    setUsers([]);
    setError(null);
    removeStored(STORAGE_KEYS.CURRENT_USER);
    void signOutSession().catch(() => setError('이 기기에서는 로그아웃했습니다. 서버 연결을 확인해 주세요.'));
  };
  const checkIdAvailable = async id => (await remoteDb.checkAvailability({ id: id.trim() })).idAvailable === true;
  const checkPhoneAvailable = async phone => (await remoteDb.checkAvailability({ phone: phone.replace(/[^0-9]/g, '') })).phoneAvailable === true;
  const validateMember = ({ id, password, name, birthDate, phone }) => {
    if (!id?.trim() || !name?.trim() || !birthDate || !phone?.trim()) throw new Error('회원 정보를 모두 입력해 주세요.');
    if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      throw new Error('비밀번호는 영문, 숫자, 기호를 포함하여 8자 이상이어야 합니다.');
    }
  };
  const register = async fields => {
    validateMember(fields);
    return remoteDb.insertUser({ ...fields, id: fields.id.trim(), role: 'student' });
  };
  const adminRegisterUser = async fields => {
    validateMember(fields);
    const version = authVersion.current;
    const user = await remoteDb.insertUser({ ...fields, id: fields.id.trim() }, true);
    if (version === authVersion.current) setUsers(prev => [...prev.filter(existing => existing.id !== user.id), user]);
    return user;
  };
  const adminDeleteUser = async userId => {
    const version = authVersion.current;
    await remoteDb.deleteUser(userId);
    if (version === authVersion.current) setUsers(prev => prev.filter(user => user.id !== userId));
    return true;
  };
  const adminResetPassword = async (userId, password) => {
    await remoteDb.updateUserPassword(userId, password);
    return true;
  };
  const resetPassword = async () => { throw new Error('교학처에 본인 확인 후 비밀번호 초기화를 요청해 주세요.'); };

  return <AuthContext.Provider value={{ currentUser, users, loading, error, sessionConflict,
    clearConflictAlert: () => setSessionConflict(false), refreshUsers, login, logout, register,
    adminRegisterUser, adminDeleteUser, adminResetPassword, checkIdAvailable, checkPhoneAvailable,
    resetPassword, isAdmin: currentUser?.role === 'admin' }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
