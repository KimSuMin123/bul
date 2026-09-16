import React, { useState, useMemo, useRef } from 'react';
import { 
  Users, CreditCard, BookOpen, Search, Plus, Check, 
  CheckCircle, Clock, Shield, Award, Edit3, Trash2, ArrowRight,
  MessageSquare, Lock, PlayCircle, UploadCloud, Film, FileVideo, 
  Loader2, Play, ExternalLink, AlertCircle, RefreshCw, X, Info,
  Image as ImageIcon, Upload, Sparkles, CheckCircle2, FileText,
  UserPlus, KeyRound, Eye, EyeOff, Copy, CheckCheck, UserCheck
} from 'lucide-react';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import { uploadLectureVideo, extractVideoMetadata, isStorageConfigured, uploadThumbnailImage } from '../services/apiClient';
import { generateMemberNumber } from '../services/certService';
import { parseExamText, DEFAULT_RAW_EXAM_TEXT } from '../services/examService';
import CertificateModal from '../components/certificate/CertificateModal';
import { useModalAlert } from '../context/ModalAlertContext';

export default function AdminDashboardPage() {
  const { showAlert, showConfirm } = useModalAlert();
  const { 
    courses, lectures, enrollments, payments, 
    enrollStudent, recordPayment, updateCourseSettings, 
    addCourse, deleteCourse, addLecture, updateLecture, deleteLecture, refreshData, qaPosts, addQAAnswer, deleteQAPost,
    certificates 
  } = useCourse();
  const { 
    currentUser, 
    users,
    refreshUsers,
    adminRegisterUser, 
    adminDeleteUser, 
    adminResetPassword, 
    checkIdAvailable, 
    checkPhoneAvailable 
  } = useAuth();

  const [activeTab, setActiveTab] = useState('enrollment'); // 'enrollment' | 'payment' | 'cms' | 'qa' | 'cert'
  
  // Student Search state
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // Certificate Register & Verify state
  const [certKeyword, setCertKeyword] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);

  const filteredCertificates = useMemo(() => {
    if (!certKeyword.trim()) return certificates || [];
    const kw = certKeyword.trim().toLowerCase();
    return (certificates || []).filter(c => 
      c.certNo.toLowerCase().includes(kw) ||
      (c.memberNo && c.memberNo.toLowerCase().includes(kw)) ||
      c.studentName.toLowerCase().includes(kw) ||
      c.courseTitle.toLowerCase().includes(kw)
    );
  }, [certificates, certKeyword]);

  // Q&A Management state
  const [qaKeyword, setQaKeyword] = useState('');
  const [qaStatusFilter, setQaStatusFilter] = useState('all'); // 'all' | 'pending' | 'answered'
  const [qaCourseFilter, setQaCourseFilter] = useState('all');
  const [replyModalPost, setReplyModalPost] = useState(null);
  const [replyMonkName, setReplyMonkName] = useState('지산 스님');
  const [replyBadgeTitle, setReplyBadgeTitle] = useState('담당 지도교수');
  const [replyContent, setReplyContent] = useState('');

  const pendingQaCount = useMemo(() => {
    return (qaPosts || []).filter(q => !q.answers || q.answers.length === 0).length;
  }, [qaPosts]);

  const filteredQAPosts = useMemo(() => {
    return (qaPosts || []).filter(post => {
      if (qaCourseFilter !== 'all' && post.courseId !== qaCourseFilter) return false;
      const hasAnswer = post.answers && post.answers.length > 0;
      if (qaStatusFilter === 'pending' && hasAnswer) return false;
      if (qaStatusFilter === 'answered' && !hasAnswer) return false;
      if (qaKeyword.trim()) {
        const kw = qaKeyword.trim().toLowerCase();
        const matchTitle = post.title.toLowerCase().includes(kw);
        const matchContent = post.content.toLowerCase().includes(kw);
        const matchAuthor = post.authorName.toLowerCase().includes(kw);
        return matchTitle || matchContent || matchAuthor;
      }
      return true;
    });
  }, [qaPosts, qaCourseFilter, qaStatusFilter, qaKeyword]);

  const handleOpenReplyModal = (post) => {
    setReplyModalPost(post);
    const existing = post.answers?.[0];
    if (existing) {
      setReplyMonkName(existing.authorName || '지산 스님');
      setReplyBadgeTitle(existing.badgeTitle || '담당 지도교수');
      setReplyContent(existing.content || '');
    } else {
      const course = courses.find(c => c.id === post.courseId);
      const defaultMonk = course?.instructor?.split('(')[0]?.trim() || '지산 스님';
      setReplyMonkName(defaultMonk);
      setReplyBadgeTitle(defaultMonk.includes('원명') ? '불교학술원 원장' : '담당 지도교수');
      setReplyContent('');
    }
  };

  const handleSaveAdminAnswer = (e) => {
    e.preventDefault();
    if (!replyModalPost || !replyContent.trim()) {
      showAlert('답변 내용을 입력해 주세요.', { type: 'warning', title: '입력 확인' });
      return;
    }

    try {
      addQAAnswer(replyModalPost.id, {
        content: replyContent,
        authorName: replyMonkName,
        badgeTitle: replyBadgeTitle
      });
      showAlert('스님 명의의 답변이 성공적으로 등록되었습니다.', { type: 'success', title: '답변 등록 완료' });
      setReplyModalPost(null);
      refreshData();
    } catch (err) {
      showAlert(err.message, { type: 'error', title: '답변 등록 오류' });
    }
  };

  const handleDeleteQA = async (postId) => {
    const ok = await showConfirm('해당 학인의 질문을 삭제하시겠습니까?\n스님의 답변도 함께 삭제됩니다.', {
      title: '질문 삭제 확인',
      type: 'warning',
      confirmText: '질문 삭제'
    });
    if (ok) {
      try {
        deleteQAPost(postId);
        refreshData();
      } catch (err) {
        showAlert(err.message, { type: 'error', title: '삭제 오류' });
      }
    }
  };
  
  // Manual grant modal state
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantCourseId, setGrantCourseId] = useState('course-ritual-8-11');
  const [grantStatus, setGrantStatus] = useState('active');

  // In-person Payment Form state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payUserId, setPayUserId] = useState('');
  const [payCourseId, setPayCourseId] = useState('course-ritual-8-11');
  const [payManager, setPayManager] = useState(currentUser?.name || '세화 교학처 담당자');
  const [payAmount, setPayAmount] = useState('50000');
  const [payMethodMemo, setPayMethodMemo] = useState('대면 카드 결제');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);

  // CMS: Course & Lecture Management state
  const [showNewCourseModal, setShowNewCourseModal] = useState(false);
  const [cmsCourseFilter, setCmsCourseFilter] = useState('all');
  const [courseForm, setCourseForm] = useState({
    id: '',
    title: '',
    subtitle: '',
    category: '불교의례법사',
    thumbnail: 'https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?auto=format&fit=crop&w=800&q=80',
    defaultPeriodDays: 90,
    sequentialUnlock: true,
    price: 50000,
    instructor: '불교의례 전문 법사',
    certType: '불교의례법사',
    certGrade: '2급',
    certTypeFull: '불교의례법사 2급',
    certRegNo: '제 2026-법사2급-0001 호',
    certRegOffice: '문화체육관광부 (민간자격 등록번호: 제 2024-003892 호)',
    rawExamText: DEFAULT_RAW_EXAM_TEXT
  });

  // CMS: Course Certificate Settings Modal state for existing courses
  const [certEditCourse, setCertEditCourse] = useState(null);
  const [certEditForm, setCertEditForm] = useState({
    certType: '',
    certGrade: '',
    certTypeFull: '',
    certRegNo: '',
    certRegOffice: '',
    rawExamText: ''
  });

  const handleExamFileUpload = (file, targetSetter) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      targetSetter(prev => ({ ...prev, rawExamText: text }));
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleOpenCertEditModal = (course) => {
    setCertEditCourse(course);
    setCertEditForm({
      certType: course.certType || '불교의례법사',
      certGrade: course.certGrade || '2급',
      certTypeFull: course.certTypeFull || `${course.certType || '불교의례법사'} ${course.certGrade || '2급'}`.trim(),
      certRegNo: course.certRegNo || '제 2026-법사2급-0001 호',
      certRegOffice: course.certRegOffice || '문화체육관광부 (민간자격 등록번호: 제 2024-003892 호)',
      rawExamText: course.rawExamText || DEFAULT_RAW_EXAM_TEXT
    });
  };

  const handleSaveCertEdit = (e) => {
    e.preventDefault();
    if (!certEditCourse) return;
    const parsed = parseExamText(certEditForm.rawExamText || '');
    updateCourseSettings(certEditCourse.id, {
      certType: certEditForm.certType.trim(),
      certGrade: certEditForm.certGrade.trim(),
      certTypeFull: certEditForm.certTypeFull.trim() || `${certEditForm.certType.trim()} ${certEditForm.certGrade.trim()}`.trim(),
      certRegNo: certEditForm.certRegNo.trim(),
      certRegOffice: certEditForm.certRegOffice.trim(),
      rawExamText: certEditForm.rawExamText || ''
    });
    showAlert(`[${certEditCourse.title}] 코스의 자격증 및 온라인 시험 설정이 성공적으로 저장되었습니다!\n\n• 자격증 종목: ${certEditForm.certTypeFull}\n• 자격증 번호 양식: ${certEditForm.certRegNo}\n• 등록된 시험 문항: 총 ${parsed.length}개 문제 (응시 시 20문항 무작위 출제)`, { type: 'success', title: '자격증/시험 설정 저장 완료' });
    setCertEditCourse(null);
    refreshData();
  };

  const handleCreateCourse = (e) => {
    e.preventDefault();
    if (!courseForm.title.trim()) {
      showAlert('코스 제목을 입력해 주세요.', { type: 'warning', title: '입력 확인' });
      return;
    }
    try {
      const parsed = parseExamText(courseForm.rawExamText || '');
      const created = addCourse(courseForm);
      showAlert(`[${created.title}] 코스가 성공적으로 개설되었습니다!\n\n• 연동 자격증: ${courseForm.certTypeFull}\n• 자격증 번호: ${courseForm.certRegNo}\n• 등록된 시험 문항: 총 ${parsed.length}개 문제`, { type: 'success', title: '코스 개설 완료' });
      setShowNewCourseModal(false);
      setCourseForm({
        id: '',
        title: '',
        subtitle: '',
        category: '불교의례법사',
        thumbnail: 'https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?auto=format&fit=crop&w=800&q=80',
        defaultPeriodDays: 90,
        sequentialUnlock: true,
        price: 50000,
        instructor: '불교의례 전문 법사',
        certType: '불교의례법사',
        certGrade: '2급',
        certTypeFull: '불교의례법사 2급',
        certRegNo: '제 2026-법사2급-0001 호',
        certRegOffice: '문화체육관광부 (민간자격 등록번호: 제 2024-003892 호)',
        rawExamText: DEFAULT_RAW_EXAM_TEXT
      });
      refreshData();
    } catch (err) {
      showAlert(`코스 생성 실패: ${err.message}`, { type: 'error', title: '코스 생성 오류' });
    }
  };

  const handleDeleteCourse = async (courseId, courseTitle) => {
    const ok = await showConfirm(`[${courseTitle}] 코스를 정말 삭제하시겠습니까?\n해당 코스에 소속된 모든 강의 차시도 함께 삭제됩니다.`, {
      title: '코스 영구 삭제',
      type: 'error',
      confirmText: '코스 삭제'
    });
    if (ok) {
      try {
        deleteCourse(courseId);
        refreshData();
        showAlert(`[${courseTitle}] 코스가 성공적으로 삭제되었습니다.`, { type: 'success', title: '코스 삭제 완료' });
      } catch (err) {
        showAlert(`삭제 실패: ${err.message}`, { type: 'error', title: '코스 삭제 오류' });
      }
    }
  };

  const handleDeleteLecture = async (lecId, lecTitle) => {
    const ok = await showConfirm(`[${lecTitle}] 차시를 정말 삭제하시겠습니까?\n잘못 등록된 차시 정보와 스트리밍 연결이 즉시 제거됩니다.`, {
      title: '차시 삭제 확인',
      type: 'error',
      confirmText: '차시 삭제'
    });
    if (ok) {
      try {
        deleteLecture(lecId);
        refreshData();
        showAlert(`[${lecTitle}] 차시가 성공적으로 삭제되었습니다.`, { type: 'success', title: '차시 삭제 완료' });
      } catch (err) {
        showAlert(`삭제 실패: ${err.message}`, { type: 'error', title: '차시 삭제 오류' });
      }
    }
  };

  // CMS: New Lecture form & Video Upload state
  const [showNewLecModal, setShowNewLecModal] = useState(false);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'url'
  const [newVideoFile, setNewVideoFile] = useState(null);
  const [newVideoPreviewUrl, setNewVideoPreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null); // { percent, loaded, total, speed }
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');
  const [uploadErrorMsg, setUploadErrorMsg] = useState('');
  const newFileInputRef = useRef(null);

  const [lecForm, setLecForm] = useState({
    courseId: 'course-ritual-8-11',
    orderIndex: 9,
    title: '',
    description: '',
    durationSeconds: 2400,
    videoUrl: '',
    attachmentName: ''
  });

  // Video Replace Modal state for existing lectures
  const [replaceModalLec, setReplaceModalLec] = useState(null);
  const [replaceVideoFile, setReplaceVideoFile] = useState(null);
  const [replaceVideoPreviewUrl, setReplaceVideoPreviewUrl] = useState('');
  const [replaceProgress, setReplaceProgress] = useState(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceSuccessMsg, setReplaceSuccessMsg] = useState('');
  const [replaceErrorMsg, setReplaceErrorMsg] = useState('');
  const replaceFileInputRef = useRef(null);

  // Video Live Preview Modal state
  const [previewModalLec, setPreviewModalLec] = useState(null);

  // Course Thumbnail Edit Modal state
  const [thumbModalCourse, setThumbModalCourse] = useState(null);
  const [thumbUrlInput, setThumbUrlInput] = useState('');
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState('');
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [thumbSuccessMsg, setThumbSuccessMsg] = useState('');
  const [thumbErrorMsg, setThumbErrorMsg] = useState('');
  const courseThumbFileInputRef = useRef(null);

  // Lecture Thumbnail Edit Modal state
  const [thumbModalLec, setThumbModalLec] = useState(null);
  const [thumbLecUrlInput, setThumbLecUrlInput] = useState('');
  const [thumbLecPreviewUrl, setThumbLecPreviewUrl] = useState('');
  const [isUploadingLecThumb, setIsUploadingLecThumb] = useState(false);
  const [thumbLecSuccessMsg, setThumbLecSuccessMsg] = useState('');
  const [thumbLecErrorMsg, setThumbLecErrorMsg] = useState('');
  const lecThumbFileInputRef = useRef(null);

  // Course Thumbnail Handlers
  const handleOpenCourseThumbModal = (course) => {
    setThumbModalCourse(course);
    setThumbUrlInput(course.thumbnail || '');
    setThumbPreviewUrl(course.thumbnail || '');
    setThumbSuccessMsg('');
    setThumbErrorMsg('');
    setIsUploadingThumb(false);
  };

  const handleCourseThumbFileSelect = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showAlert('이미지 파일(JPG, PNG, WebP 등)만 업로드할 수 있습니다.', { type: 'warning', title: '파일 형식 안내' });
      return;
    }
    try {
      setIsUploadingThumb(true);
      setThumbErrorMsg('');
      setThumbSuccessMsg('');
      const res = await uploadThumbnailImage(file);
      setThumbPreviewUrl(res.publicUrl);
      setThumbUrlInput(res.publicUrl);
      setThumbSuccessMsg('썸네일 이미지가 성공적으로 최적화되었습니다.');
    } catch (err) {
      setThumbErrorMsg(`이미지 처리 실패: ${err.message}`);
    } finally {
      setIsUploadingThumb(false);
    }
  };

  const handleSaveCourseThumbnail = (e) => {
    if (e) e.preventDefault();
    if (!thumbModalCourse) return;
    const finalUrl = thumbPreviewUrl?.trim() || thumbUrlInput?.trim();
    if (!finalUrl) {
      showAlert('썸네일 이미지 URL을 입력하거나 이미지 파일을 선택해 주세요.', { type: 'warning', title: '입력 확인' });
      return;
    }
    try {
      updateCourseSettings(thumbModalCourse.id, { thumbnail: finalUrl });
      setThumbSuccessMsg('강의 썸네일이 성공적으로 변경되었습니다!');
      refreshData();
      setTimeout(() => {
        setThumbModalCourse(null);
      }, 1000);
    } catch (err) {
      showAlert(`썸네일 저장 실패: ${err.message}`, { type: 'error', title: '저장 오류' });
    }
  };

  // Lecture Thumbnail Handlers
  const handleOpenLecThumbModal = (lec) => {
    setThumbModalLec(lec);
    const initialUrl = lec.thumbnail || courses.find(c => c.id === lec.courseId)?.thumbnail || '';
    setThumbLecUrlInput(initialUrl);
    setThumbLecPreviewUrl(initialUrl);
    setThumbLecSuccessMsg('');
    setThumbLecErrorMsg('');
    setIsUploadingLecThumb(false);
  };

  const handleLecThumbFileSelect = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showAlert('이미지 파일(JPG, PNG, WebP 등)만 업로드할 수 있습니다.', { type: 'warning', title: '파일 형식 안내' });
      return;
    }
    try {
      setIsUploadingLecThumb(true);
      setThumbLecErrorMsg('');
      setThumbLecSuccessMsg('');
      const res = await uploadThumbnailImage(file);
      setThumbLecPreviewUrl(res.publicUrl);
      setThumbLecUrlInput(res.publicUrl);
      setThumbLecSuccessMsg('차시 썸네일 이미지가 최적화되었습니다.');
    } catch (err) {
      setThumbLecErrorMsg(`이미지 처리 실패: ${err.message}`);
    } finally {
      setIsUploadingLecThumb(false);
    }
  };

  const handleSaveLecThumbnail = (e) => {
    if (e) e.preventDefault();
    if (!thumbModalLec) return;
    const finalUrl = thumbLecPreviewUrl?.trim() || thumbLecUrlInput?.trim();
    if (!finalUrl) {
      showAlert('차시 썸네일 이미지 URL을 입력하거나 이미지 파일을 선택해 주세요.', { type: 'warning', title: '입력 확인' });
      return;
    }
    try {
      updateLecture(thumbModalLec.id, { thumbnail: finalUrl });
      setThumbLecSuccessMsg('차시 썸네일이 성공적으로 저장되었습니다!');
      refreshData();
      setTimeout(() => {
        setThumbModalLec(null);
      }, 1000);
    } catch (err) {
      showAlert(`차시 썸네일 저장 실패: ${err.message}`, { type: 'error', title: '저장 오류' });
    }
  };

  // Handle New Lecture Video File Selection & Duration auto-detection
  const handleNewVideoFileSelect = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i)) {
      showAlert('동영상 파일(.mp4, .mov, .webm, .mkv 등)만 업로드할 수 있습니다.', { type: 'warning', title: '파일 형식 안내' });
      return;
    }

    setNewVideoFile(file);
    setUploadErrorMsg('');
    setUploadSuccessMsg('');
    setUploadProgress(null);

    const preview = URL.createObjectURL(file);
    setNewVideoPreviewUrl(preview);

    try {
      const meta = await extractVideoMetadata(file);
      if (meta && meta.duration) {
        setLecForm(prev => ({
          ...prev,
          durationSeconds: meta.duration,
          title: prev.title || file.name.replace(/\.[^/.]+$/, "")
        }));
      }
    } catch (e) {
      console.warn('Metadata extract note:', e);
    }
  };

  // Handle Replace Video File Selection
  const handleReplaceVideoFileSelect = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i)) {
      showAlert('동영상 파일(.mp4, .mov, .webm, .mkv 등)만 업로드할 수 있습니다.', { type: 'warning', title: '파일 형식 안내' });
      return;
    }

    setReplaceVideoFile(file);
    setReplaceErrorMsg('');
    setReplaceSuccessMsg('');
    setReplaceProgress(null);

    const preview = URL.createObjectURL(file);
    setReplaceVideoPreviewUrl(preview);
  };

  // Handle Replace Video Submit
  const handleReplaceVideoSubmit = async (e) => {
    e.preventDefault();
    if (!replaceModalLec || !replaceVideoFile) {
      showAlert('교체할 동영상 파일을 선택해 주세요.', { type: 'warning', title: '파일 선택' });
      return;
    }

    try {
      setIsReplacing(true);
      setReplaceErrorMsg('');
      setReplaceSuccessMsg('');

      const meta = await extractVideoMetadata(replaceVideoFile);
      const result = await uploadLectureVideo(replaceVideoFile, (prog) => {
        setReplaceProgress(prog);
      });

      updateLecture(replaceModalLec.id, {
        videoUrl: result.publicUrl,
        durationSeconds: meta.duration || replaceModalLec.durationSeconds
      });

      const compText = result.compressedMb ? ` (${result.originalMb}MB ➔ ${result.compressedMb}MB 압축)` : '';
      setReplaceSuccessMsg(`동영상 파일이 1080p 고화질로 자동 최적화되어 서버 스토리지로 교체되었습니다!${compText}`);
      refreshData();

      setTimeout(() => {
        setReplaceModalLec(null);
        setReplaceVideoFile(null);
        setReplaceVideoPreviewUrl('');
        setReplaceProgress(null);
        setIsReplacing(false);
      }, 1400);
    } catch (err) {
      setIsReplacing(false);
      setReplaceErrorMsg(`업로드 실패: ${err.message}`);
      showAlert(`동영상 업로드 실패: ${err.message}`, { type: 'error', title: '업로드 오류' });
    }
  };

  // Version tracker to trigger instant reactive re-renders when users are added/modified
  const [usersVersion, setUsersVersion] = useState(0);

  // Admin Manual User Register Modal State
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    id: '',
    phone: '',
    birthDate: '',
    role: 'student',
    password: 'buddha1234!',
    memberNo: '',
    assignCourse: true,
    courseId: 'course-ritual-8-11',
    status: 'active',
    recordPayment: true,
    paymentAmount: '50000',
    paymentMethodMemo: '대면 접수 / 현장 결제'
  });
  const [showNewUserPw, setShowNewUserPw] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [userModalError, setUserModalError] = useState('');

  // User Register Success Summary Modal State
  const [createdUserInfo, setCreatedUserInfo] = useState(null);
  const [copiedInfo, setCopiedInfo] = useState(false);

  // Admin Password Reset Modal State
  const [resetPwUser, setResetPwUser] = useState(null);
  const [newTempPassword, setNewTempPassword] = useState('buddha1234!');
  const [isResettingPw, setIsResettingPw] = useState(false);

  const handleOpenNewUserModal = () => {
    const defaultMemberNo = generateMemberNumber();
    const firstCourse = courses[0];
    setNewUserForm({
      name: '',
      id: '',
      phone: '',
      birthDate: '',
      role: 'student',
      password: 'buddha1234!',
      memberNo: defaultMemberNo,
      assignCourse: true,
      courseId: firstCourse ? firstCourse.id : 'course-ritual-8-11',
      status: 'active',
      recordPayment: true,
      paymentAmount: firstCourse ? String(firstCourse.price || 50000) : '50000',
      paymentMethodMemo: '대면 접수 / 현장 결제'
    });
    setUserModalError('');
    setShowNewUserPw(false);
    setShowNewUserModal(true);
  };

  const handleSuggestId = () => {
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const generated = `buddha_${randSuffix}`;
    setNewUserForm(prev => ({ ...prev, id: generated }));
  };

  const handleNewUserCourseChange = (courseId) => {
    const selected = courses.find(c => c.id === courseId);
    setNewUserForm(prev => ({
      ...prev,
      courseId,
      paymentAmount: selected ? String(selected.price || 50000) : prev.paymentAmount
    }));
  };

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    setUserModalError('');

    if (!newUserForm.name.trim()) {
      setUserModalError('성명(또는 법명)을 입력해 주세요.');
      return;
    }
    if (!newUserForm.id.trim()) {
      setUserModalError('아이디를 입력해 주세요.');
      return;
    }
    if (!newUserForm.password || newUserForm.password.trim().length < 4) {
      setUserModalError('비밀번호는 최소 4자리 이상 입력해 주세요.');
      return;
    }
    if (!newUserForm.phone.trim()) {
      setUserModalError('휴대전화 번호를 입력해 주세요.');
      return;
    }
    if (!newUserForm.birthDate) {
      setUserModalError('생년월일을 입력해 주세요.');
      return;
    }

    try {
      setIsSubmittingUser(true);

      // 1. Register User via AuthContext
      const registered = adminRegisterUser({
        id: newUserForm.id.trim(),
        password: newUserForm.password.trim(),
        name: newUserForm.name.trim(),
        birthDate: newUserForm.birthDate,
        phone: newUserForm.phone.trim(),
        role: newUserForm.role,
        memberNo: newUserForm.memberNo.trim()
      });

      // 2. Assign Course if selected
      let assignedCourseTitle = '';
      let assignedStatusText = '';
      if (newUserForm.assignCourse && newUserForm.courseId) {
        enrollStudent(registered.id, newUserForm.courseId, newUserForm.status);
        const c = courses.find(item => item.id === newUserForm.courseId);
        assignedCourseTitle = c?.title || newUserForm.courseId;
        assignedStatusText = newUserForm.status === 'active' ? '수강중 (결제완료)' : 
                             newUserForm.status === 'pending' ? '결제대기' : '수강신청 접수';

        // 3. Record Payment in ledger if selected
        if (newUserForm.recordPayment && newUserForm.status === 'active') {
          recordPayment({
            userId: registered.id,
            courseId: newUserForm.courseId,
            manager: currentUser?.name || '세화 교학처 담당자',
            amount: parseInt(newUserForm.paymentAmount || '0', 10),
            methodMemo: newUserForm.paymentMethodMemo || '대면 접수 / 현장 결제',
            paidAt: new Date().toISOString().split('T')[0]
          });
        }
      }

      // 4. Update UI State
      setUsersVersion(v => v + 1);
      refreshData();
      setShowNewUserModal(false);

      // 5. Open Success Summary Modal
      setCreatedUserInfo({
        ...registered,
        assignedCourseTitle,
        assignedStatusText
      });
      setCopiedInfo(false);

    } catch (err) {
      setUserModalError(err.message || '회원 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleCopyUserInfo = () => {
    if (!createdUserInfo) return;
    const msg = `[세화붓다아카데미 학인 계정 등록 안내]
- 성명: ${createdUserInfo.name}
- 학번/식별번호: ${createdUserInfo.memberNo}
- 아이디: ${createdUserInfo.id}
- 임시 비밀번호: ${createdUserInfo.password}
${createdUserInfo.assignedCourseTitle ? `- 수강 강좌: ${createdUserInfo.assignedCourseTitle} (${createdUserInfo.assignedStatusText})` : ''}
* 세화붓다아카데미에 오신 것을 환영합니다. 로그인 후 상단 [내 강의실]에서 강의를 시청하실 수 있습니다.`;

    navigator.clipboard.writeText(msg).then(() => {
      setCopiedInfo(true);
      setTimeout(() => setCopiedInfo(false), 2500);
    });
  };

  const handleDeleteUser = async (user) => {
    if (user.id === 'admin') {
      showAlert('최고관리자(admin) 계정은 시스템 보호를 위해 삭제할 수 없습니다.', { type: 'warning', title: '계정 보호' });
      return;
    }
    if (currentUser && currentUser.id === user.id) {
      showAlert('현재 로그인 중인 본인 계정은 삭제할 수 없습니다.', { type: 'warning', title: '계정 삭제 불가' });
      return;
    }

    const confirmMsg = `[${user.name} (${user.id})] 회원을 정말 삭제하시겠습니까?\n\n※ 해당 회원의 수강 이력 및 대면 결제 장부 기록도 함께 정리됩니다.`;
    const ok = await showConfirm(confirmMsg, {
      title: '회원 계정 삭제 확인',
      type: 'error',
      confirmText: '회원 삭제'
    });
    if (ok) {
      try {
        adminDeleteUser(user.id);
        setUsersVersion(v => v + 1);
        refreshData();
        showAlert(`[${user.name}] 회원 계정이 정상적으로 삭제되었습니다.`, { type: 'success', title: '회원 삭제 완료' });
      } catch (err) {
        showAlert(`삭제 실패: ${err.message}`, { type: 'error', title: '삭제 오류' });
      }
    }
  };

  const handleExecuteResetPassword = (e) => {
    e.preventDefault();
    if (!resetPwUser) return;
    if (!newTempPassword || newTempPassword.trim().length < 4) {
      showAlert('새 비밀번호는 최소 4자 이상이어야 합니다.', { type: 'warning', title: '입력 확인' });
      return;
    }

    try {
      setIsResettingPw(true);
      adminResetPassword(resetPwUser.id, newTempPassword.trim());
      setUsersVersion(v => v + 1);
      showAlert(`[${resetPwUser.name}] 님의 비밀번호가 '${newTempPassword.trim()}'(으)로 성공적으로 초기화되었습니다.\n학인에게 변경된 비밀번호를 안내해 주시기 바랍니다.`, { type: 'success', title: '비밀번호 초기화 완료' });
      setResetPwUser(null);
    } catch (err) {
      showAlert(`비밀번호 초기화 실패: ${err.message}`, { type: 'error', title: '초기화 오류' });
    } finally {
      setIsResettingPw(false);
    }
  };

  // Get all users from Supabase-backed AuthContext
  const allUsers = useMemo(() => {
    return users || [];
  }, [users]);

  // Filtered users by search keyword (name or phone)
  const filteredUsers = useMemo(() => {
    if (!searchKeyword.trim()) return allUsers;
    const kw = searchKeyword.trim().toLowerCase();
    return allUsers.filter(u => 
      u.name.toLowerCase().includes(kw) || 
      u.phone.replace(/[^0-9]/g, '').includes(kw.replace(/[^0-9]/g, '')) ||
      u.id.toLowerCase().includes(kw) ||
      (u.memberNo && u.memberNo.toLowerCase().includes(kw))
    );
  }, [allUsers, searchKeyword]);

  // Handle Manual Enrollment Grant
  const handleGrantEnrollment = (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    enrollStudent(selectedUser.id, grantCourseId, grantStatus);
    showAlert(`${selectedUser.name} 님에게 [${courses.find(c => c.id === grantCourseId)?.title}] 강좌의 권한(${grantStatus})이 성공적으로 부여되었습니다.`, { type: 'success', title: '수강 권한 부여 완료' });
    setShowGrantModal(false);
    refreshData();
  };

  // Handle In-Person Payment Record
  const handleRecordPayment = (e) => {
    e.preventDefault();
    if (!payUserId) {
      showAlert('회원을 선택해 주세요.', { type: 'warning', title: '입력 확인' });
      return;
    }

    recordPayment({
      userId: payUserId,
      courseId: payCourseId,
      manager: payManager,
      amount: parseInt(payAmount, 10),
      methodMemo: payMethodMemo,
      paidAt: payDate
    });

    showAlert('대면 수납 내역이 장부에 기록되었으며, 해당 회원의 수강 상태가 [수강중(결제완료)]으로 전환되었습니다.', { type: 'success', title: '수납 처리 완료' });
    setShowPaymentModal(false);
    refreshData();
  };

  // Pending Enrollments (waiting for in-person payment)
  const pendingEnrollments = useMemo(() => {
    return (enrollments || []).filter(e => e.status === 'pending' || e.status === 'applied');
  }, [enrollments]);

  // Integrated Full Payment Records (payments + any active enrollments missing payment record)
  const fullPaymentRecords = useMemo(() => {
    const records = [...(payments || [])];
    (enrollments || []).forEach(enr => {
      if (enr.status === 'active' || enr.status === 'completed') {
        const hasPay = records.some(p => p.userId === enr.userId && p.courseId === enr.courseId);
        if (!hasPay) {
          const course = courses.find(c => c.id === enr.courseId);
          records.push({
            id: `auto_${enr.id}`,
            userId: enr.userId,
            courseId: enr.courseId,
            paidAt: enr.paidAt || enr.enrolledAt || '2026-01-01',
            manager: currentUser?.name || '교학처 관리자',
            amount: course?.price || 50000,
            methodMemo: '대면 수납 승인 (현금/카드/계좌이체)'
          });
        }
      }
    });
    return records.sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));
  }, [payments, enrollments, courses, currentUser]);

  // 1-Click Approve Pending Payment
  const handleApprovePendingPayment = async (enr) => {
    const student = allUsers.find(u => u.id === enr.userId);
    const course = courses.find(c => c.id === enr.courseId);
    const studentName = student ? student.name : enr.userId;
    const courseTitle = course ? course.title : enr.courseId;
    const amount = course ? course.price : 50000;

    const ok = await showConfirm(`[${studentName}] 학인의 [${courseTitle}] 대면 수납을 승인하시겠습니까?\n\n• 수납 금액: ${amount.toLocaleString()}원\n• 승인 즉시 장부에 등재되며, 학인의 '내 강의실' 상태가 [수강 중]으로 전환되어 모든 강의를 시청할 수 있습니다.`, {
      title: '대면 수납 승인 확인',
      type: 'info',
      confirmText: '수납 승인'
    });
    if (ok) {
      recordPayment({
        userId: enr.userId,
        courseId: enr.courseId,
        manager: currentUser?.name || '교학처 관리자',
        amount: amount,
        methodMemo: '교학처 방문 대면 수납 승인',
        paidAt: new Date().toISOString().split('T')[0]
      });
      showAlert(`[${studentName}] 학인의 대면 수납 승인이 완료되었습니다!\n장부에 정상 등재되었으며, 이제 수강이 시작됩니다.`, { type: 'success', title: '수납 승인 완료' });
      refreshData();
    }
  };

  // Handle Sequential Lock Toggle
  const handleToggleSequential = (courseId, currentVal) => {
    updateCourseSettings(courseId, { sequentialUnlock: !currentVal });
    refreshData();
  };

  // Handle Create Lecture (with site-direct video upload)
  const handleCreateLecture = async (e) => {
    e.preventDefault();
    if (!lecForm.title.trim()) {
      showAlert('강의 제목을 입력해 주세요.', { type: 'warning', title: '입력 확인' });
      return;
    }

    let finalVideoUrl = lecForm.videoUrl;

    // Direct Video Upload to Server Storage
    if (uploadMode === 'file') {
      if (!newVideoFile && !finalVideoUrl) {
        showAlert('동영상 파일을 먼저 선택해 주세요.', { type: 'warning', title: '파일 선택' });
        return;
      }

      if (newVideoFile) {
        try {
          setIsUploading(true);
          setUploadErrorMsg('');
          setUploadSuccessMsg('');

          const result = await uploadLectureVideo(newVideoFile, (prog) => {
            setUploadProgress(prog);
          });
          finalVideoUrl = result.publicUrl;
          const compText = result.compressedMb ? ` (${result.originalMb}MB ➔ ${result.compressedMb}MB 압축 완료)` : '';
          setUploadSuccessMsg(`서버 스토리지로 영상 업로드 및 1080p 고화질 최적화가 완료되었습니다!${compText}`);
        } catch (err) {
          setIsUploading(false);
          setUploadErrorMsg(`업로드 오류: ${err.message}`);
          showAlert(`서버 업로드 오류: ${err.message}`, { type: 'error', title: '업로드 오류' });
          return;
        } finally {
          setIsUploading(false);
        }
      }
    } else {
      if (!finalVideoUrl.trim()) {
        showAlert('동영상 소스 URL을 입력해 주세요.', { type: 'warning', title: '입력 확인' });
        return;
      }
    }

    addLecture({
      courseId: lecForm.courseId,
      orderIndex: Number(lecForm.orderIndex),
      title: lecForm.title,
      description: lecForm.description,
      durationSeconds: Number(lecForm.durationSeconds),
      videoUrl: finalVideoUrl,
      attachments: lecForm.attachmentName ? [{ name: lecForm.attachmentName, size: '2.5 MB' }] : []
    });

    showAlert(`[${lecForm.title}] 차시가 성공적으로 등록되었습니다!\n영상은 프라이빗 서버에서 즉시 고화질 스트리밍됩니다.`, { type: 'success', title: '차시 등록 완료' });
    setShowNewLecModal(false);
    setNewVideoFile(null);
    setNewVideoPreviewUrl('');
    setUploadProgress(null);
    setUploadSuccessMsg('');
    setUploadErrorMsg('');
    refreshData();
  };

  return (
    <div style={{ padding: '36px 0 80px 0' }}>
      <div className="container">
        
        {/* Admin Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="badge badge-coral" style={{ marginBottom: '6px' }}>
              <Shield size={12} />
              <span>세화불학원 관리자 CMS</span>
            </div>
            <h1 className="heading-1 font-serif">학사 및 콘텐츠 관리 시스템 (CMS)</h1>
          </div>

          <div className="admin-header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary btn-sm"
              style={{ backgroundColor: 'var(--color-sage)', borderColor: 'var(--color-sage)' }}
              onClick={handleOpenNewUserModal}
            >
              <UserPlus size={15} />
              <span>+ 신규 사용자 직접 등록</span>
            </button>
            <button 
              className="btn btn-amber btn-sm"
              onClick={() => setShowPaymentModal(true)}
            >
              <CreditCard size={15} />
              <span>+ 대면 수납 등록</span>
            </button>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowNewLecModal(true)}
            >
              <Plus size={15} />
              <span>+ 신규 VOD 차시 등록</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mobile-tab-scroll" style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--color-border)', marginBottom: '28px' }}>
          <button 
            className="btn btn-ghost" 
            style={{ 
              borderBottom: activeTab === 'enrollment' ? '3px solid var(--color-sage)' : '3px solid transparent',
              borderRadius: '0',
              fontWeight: activeTab === 'enrollment' ? 700 : 500,
              color: activeTab === 'enrollment' ? 'var(--color-sage)' : 'var(--color-text-muted)',
              padding: '12px 18px'
            }}
            onClick={() => setActiveTab('enrollment')}
          >
            <Users size={16} />
            <span>수강생 및 권한 관리</span>
          </button>

          <button 
            className="btn btn-ghost" 
            style={{ 
              borderBottom: activeTab === 'payment' ? '3px solid var(--color-sage)' : '3px solid transparent',
              borderRadius: '0',
              fontWeight: activeTab === 'payment' ? 700 : 500,
              color: activeTab === 'payment' ? 'var(--color-sage)' : 'var(--color-text-muted)',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('payment')}
          >
            <CreditCard size={16} />
            <span>교학처 대면 수납 내역 장부 ({fullPaymentRecords.length}건)</span>
            {pendingEnrollments.length > 0 && (
              <span className="badge badge-amber" style={{ fontSize: '11px', padding: '1px 6px' }}>
                대기 {pendingEnrollments.length}
              </span>
            )}
          </button>

          <button 
            className="btn btn-ghost" 
            style={{ 
              borderBottom: activeTab === 'cms' ? '3px solid var(--color-sage)' : '3px solid transparent',
              borderRadius: '0',
              fontWeight: activeTab === 'cms' ? 700 : 500,
              color: activeTab === 'cms' ? 'var(--color-sage)' : 'var(--color-text-muted)',
              padding: '12px 18px'
            }}
            onClick={() => setActiveTab('cms')}
          >
            <BookOpen size={16} />
            <span>코스 & VOD 콘텐츠 관리</span>
          </button>

          <button 
            className="btn btn-ghost" 
            style={{ 
              borderBottom: activeTab === 'qa' ? '3px solid var(--color-sage)' : '3px solid transparent',
              borderRadius: '0',
              fontWeight: activeTab === 'qa' ? 700 : 500,
              color: activeTab === 'qa' ? 'var(--color-sage)' : 'var(--color-text-muted)',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('qa')}
          >
            <MessageSquare size={16} />
            <span>학습 Q&A 질의응답 관리 ({qaPosts?.length || 0})</span>
            {pendingQaCount > 0 && (
              <span className="badge badge-amber" style={{ fontSize: '11px', padding: '1px 6px' }}>
                대기 {pendingQaCount}
              </span>
            )}
          </button>

          <button 
            className="btn btn-ghost" 
            style={{ 
              borderBottom: activeTab === 'cert' ? '3px solid var(--color-sage)' : '3px solid transparent',
              borderRadius: '0',
              fontWeight: activeTab === 'cert' ? 700 : 500,
              color: activeTab === 'cert' ? 'var(--color-sage)' : 'var(--color-text-muted)',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('cert')}
          >
            <Award size={16} />
            <span>수료증 발급 및 진위 확인 대장 ({certificates?.length || 0})</span>
          </button>
        </div>

        {/* TAB 1: 수강생 및 권한 관리 (Search by name/phone, manual grant) */}
        {activeTab === 'enrollment' && (
          <div>
            {/* 권한 관리 상단 현황 배너 */}
            <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--color-surface-warm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-sage)' }}>
                  <Shield size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>접속 관리자 권한 상태</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-charcoal)' }}>
                    {currentUser?.name || '최고관리자'} <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-sage)' }}>(권한: {currentUser?.role === 'admin' ? '최고관리자 Master Admin' : currentUser?.role})</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', fontSize: '13px' }}>
                <div style={{ background: '#FFFFFF', padding: '6px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ color: '#64748B' }}>등록 회원:</span> <strong>{allUsers.length}명</strong>
                  <span style={{ color: '#94A3B8', marginLeft: '6px' }}>(관리자 {allUsers.filter(u => u.role === 'admin').length}명 / 수강생 {allUsers.filter(u => u.role !== 'admin').length}명)</span>
                </div>
                <div style={{ background: '#FFFFFF', padding: '6px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ color: '#64748B' }}>수강 권한:</span>{' '}
                  <strong style={{ color: 'var(--color-sage)' }}>수강중 {enrollments.filter(e => e.status === 'active').length}건</strong>{' '}
                  <span style={{ color: '#CBD5E1' }}>|</span>{' '}
                  <strong style={{ color: '#D97706' }}>대기 {pendingEnrollments.length}건</strong>{' '}
                  <span style={{ color: '#CBD5E1' }}>|</span>{' '}
                  <strong style={{ color: '#D49B4B' }}>수료 {enrollments.filter(e => e.status === 'completed').length}건</strong>
                </div>
              </div>
            </div>

            {/* Search Bar & Actions */}
            <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                  <Search size={17} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="수강생 검색 (이름, 휴대전화 번호, 아이디, 회원번호)"
                    style={{ paddingLeft: '38px' }}
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                  />
                </div>
                <div className="text-caption" style={{ whiteSpace: 'nowrap' }}>
                  총 {filteredUsers.length}명 검색됨
                </div>
                <button 
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--color-sage)', borderColor: 'var(--color-sage)', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={handleOpenNewUserModal}
                >
                  <UserPlus size={16} />
                  <span>+ 신규 사용자 직접 등록</span>
                </button>
                <button 
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => setActiveTab('payment')}
                >
                  <CreditCard size={15} color="var(--color-sage)" />
                  <span>교학처 대면 수납 내역 장부 (완료 {fullPaymentRecords.length} / 대기 {pendingEnrollments.length})</span>
                </button>
              </div>
            </div>

            {/* Students Table */}
            <div className="card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-warm)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-charcoal)' }}>
                    <th style={{ padding: '12px 16px' }}>회원 식별번호</th>
                    <th style={{ padding: '12px 16px' }}>성명 / 아이디</th>
                    <th style={{ padding: '12px 16px' }}>전화번호</th>
                    <th style={{ padding: '12px 16px' }}>생년월일</th>
                    <th style={{ padding: '12px 16px' }}>수강 중인 코스 & 상태</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>관리 및 조치</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const userEnrs = enrollments.filter(e => e.userId === user.id);

                    return (
                      <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {user.memberNo || 'BUDDHA-2026-SYS'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <strong>{user.name}</strong>{' '}
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>({user.id})</span>
                          {user.role === 'admin' && (
                            <span className="badge badge-coral" style={{ marginLeft: '6px', fontSize: '10.5px' }}>관리자</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#4A5568' }}>{user.phone}</td>
                        <td style={{ padding: '14px 16px', color: '#4A5568' }}>{user.birthDate}</td>
                        <td style={{ padding: '14px 16px' }}>
                          {userEnrs.length === 0 ? (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>수강 이력 없음</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {userEnrs.map(enr => {
                                const c = courses.find(item => item.id === enr.courseId);
                                return (
                                  <div key={enr.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                    <span style={{ fontWeight: 600 }}>{c ? c.title.substring(0, 18) + '...' : enr.courseId}</span>
                                    <span className={`badge ${
                                      enr.status === 'completed' ? 'badge-sage' : 
                                      enr.status === 'active' ? 'badge-sage' : 'badge-amber'
                                    }`}>
                                      {enr.status === 'active' ? '수강중(결제완료)' : 
                                       enr.status === 'completed' ? '수료' : 
                                       enr.status === 'pending' ? '결제대기' : '수강신청'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'nowrap' }}>
                            <button 
                              className="btn btn-secondary btn-sm"
                              title="수강 권한 부여/수정"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowGrantModal(true);
                              }}
                            >
                              <Edit3 size={13} />
                              <span>권한 관리</span>
                            </button>
                            <button 
                              className="btn btn-ghost btn-sm"
                              title="임시 비밀번호로 초기화"
                              style={{ color: 'var(--color-amber)', border: '1px solid rgba(217, 119, 6, 0.25)', padding: '5px 8px' }}
                              onClick={() => {
                                setResetPwUser(user);
                                setNewTempPassword('buddha1234!');
                              }}
                            >
                              <KeyRound size={13} />
                              <span>비번 초기화</span>
                            </button>
                            {user.role !== 'admin' && (
                              <button 
                                className="btn btn-ghost btn-sm"
                                title="회원 계정 영구 삭제"
                                style={{ color: '#DC2626', border: '1px solid rgba(220, 38, 38, 0.2)', padding: '5px 8px' }}
                                onClick={() => handleDeleteUser(user)}
                              >
                                <Trash2 size={13} />
                                <span>삭제</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: 대면 결제 수납 대장 */}
        {activeTab === 'payment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Top Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--color-sage)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>총 수납 완료 금액</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-sage)' }}>
                  {fullPaymentRecords.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}원
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                  총 {fullPaymentRecords.length}건 수납 완료
                </div>
              </div>

              <div className="card" style={{ padding: '20px', borderLeft: '4px solid #F59E0B' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>대면 수납 대기 (미납)</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706' }}>
                  {pendingEnrollments.length}명
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                  방문/확인 후 즉시 승인 가능
                </div>
              </div>

              <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--color-charcoal)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>전체 등록 수강생</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-charcoal)' }}>
                  {allUsers.filter(u => u.role !== 'admin').length}명
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                  세화불학원 등록 학인
                </div>
              </div>
            </div>

            {/* SECTION 1: 대면 수납 대기 (납부전) 목록 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className="heading-3 font-serif" style={{ margin: 0 }}>
                      ⏳ 대면 수납 대기 (납부전) 신청 목록
                    </h3>
                    <span className="badge badge-amber" style={{ fontWeight: 700 }}>
                      {pendingEnrollments.length}건
                    </span>
                  </div>
                  <p className="text-caption" style={{ marginTop: '4px' }}>
                    온라인 수강신청을 완료했거나 관리자에게 대기 접수된 학인입니다. 교학처에서 수강료 수납 후 [수납 확인 및 승인]을 누르면 즉시 수강이 시작됩니다.
                  </p>
                </div>
              </div>

              <div className="card" style={{ overflowX: 'auto' }}>
                {pendingEnrollments.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <CheckCircle2 size={32} style={{ color: 'var(--color-sage)', opacity: 0.7, margin: '0 auto 8px auto' }} />
                    <p style={{ fontWeight: 600, color: 'var(--color-charcoal)', margin: 0 }}>현재 대면 수납 대기 중인 신청 건이 없습니다.</p>
                    <p style={{ fontSize: '12.5px', marginTop: '4px' }}>모든 신청 학인의 수납이 완료되었거나 대기 신청이 없습니다.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
                        <th style={{ padding: '12px 16px', color: '#92400E' }}>신청일자</th>
                        <th style={{ padding: '12px 16px', color: '#92400E' }}>수강생 성명 (아이디 / 연락처)</th>
                        <th style={{ padding: '12px 16px', color: '#92400E' }}>신청 강좌명</th>
                        <th style={{ padding: '12px 16px', color: '#92400E' }}>수강료</th>
                        <th style={{ padding: '12px 16px', color: '#92400E' }}>진행 상태</th>
                        <th style={{ padding: '12px 16px', color: '#92400E', textAlign: 'center' }}>대면 수납 승인 조치</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingEnrollments.map(enr => {
                        const student = allUsers.find(u => u.id === enr.userId);
                        const course = courses.find(c => c.id === enr.courseId);
                        const amount = course ? course.price : 50000;

                        return (
                          <tr key={enr.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '14px 16px', color: '#64748B' }}>{enr.enrolledAt || '접수 완료'}</td>
                            <td style={{ padding: '14px 16px' }}>
                              <strong>{student ? student.name : enr.userId}</strong>{' '}
                              <span style={{ color: '#64748B', fontSize: '12px' }}>({enr.userId})</span>
                              {student?.phone && (
                                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                                  ☎ {student.phone}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                              {course ? course.title : enr.courseId}
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-charcoal)' }}>
                              {amount.toLocaleString()}원
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span className="badge badge-amber" style={{ background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}>
                                <Clock size={12} />
                                <span>대면 결제 대기</span>
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                              <button 
                                className="btn btn-amber btn-sm"
                                style={{ backgroundColor: '#D49B4B', borderColor: '#B8860B', color: '#FFFFFF', fontWeight: 700 }}
                                onClick={() => handleApprovePendingPayment(enr)}
                              >
                                <CreditCard size={14} />
                                <span>대면 수납 확인 및 승인</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* SECTION 2: 교학처 대면 수납 완료 장부 (영구 기록) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className="heading-3 font-serif" style={{ margin: 0 }}>
                      🏛️ 교학처 대면 수납 완료 장부
                    </h3>
                    <span className="badge badge-sage" style={{ fontWeight: 700 }}>
                      {fullPaymentRecords.length}건 등재됨
                    </span>
                  </div>
                  <p className="text-caption" style={{ marginTop: '4px' }}>
                    현금, 카드, 계좌이체 등 대면 방문 수납이 완료되어 수강이 승인된 공식 장부 기록입니다.
                  </p>
                </div>
                <button className="btn btn-amber btn-sm" onClick={() => setShowPaymentModal(true)}>
                  <Plus size={14} />
                  <span>신규 수납 직접 기록하기</span>
                </button>
              </div>

              <div className="card" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-surface-warm)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '12px 16px' }}>수납일자</th>
                      <th style={{ padding: '12px 16px' }}>수강생 성명 (ID)</th>
                      <th style={{ padding: '12px 16px' }}>수강 대상 코스</th>
                      <th style={{ padding: '12px 16px' }}>수납 금액</th>
                      <th style={{ padding: '12px 16px' }}>수납 담당자</th>
                      <th style={{ padding: '12px 16px' }}>결제수단 및 비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullPaymentRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '50px 16px', color: 'var(--color-text-muted)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <CreditCard size={38} style={{ opacity: 0.35, color: 'var(--color-sage)' }} />
                            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-charcoal)' }}>
                              현재 등록된 교학처 대면 수납 내역이 없습니다.
                            </div>
                            <p style={{ fontSize: '13px', margin: 0, maxWidth: '450px', lineHeight: '1.6' }}>
                              위 대면 수납 대기 목록에서 <strong>[대면 수납 확인 및 승인]</strong>을 누르시거나, 상단의 <strong>[신규 수납 직접 기록하기]</strong>를 통해 수납 내역을 등재해 주세요.
                            </p>
                            <button 
                              type="button"
                              className="btn btn-amber btn-sm" 
                              style={{ marginTop: '8px' }}
                              onClick={() => setShowPaymentModal(true)}
                            >
                              <Plus size={14} />
                              <span>대면 수납 내역 직접 등록하기</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      fullPaymentRecords.map(pay => {
                        const student = allUsers.find(u => u.id === pay.userId);
                        const course = courses.find(c => c.id === pay.courseId);

                        return (
                          <tr key={pay.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '14px 16px', fontWeight: 600 }}>{pay.paidAt}</td>
                            <td style={{ padding: '14px 16px' }}>
                              <strong>{student ? student.name : pay.userId}</strong>{' '}
                              <span style={{ color: '#64748B', fontSize: '12px' }}>({pay.userId})</span>
                              {student?.memberNo && (
                                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                                  {student.memberNo}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '14px 16px' }}>{course ? course.title : pay.courseId}</td>
                            <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-sage)' }}>
                              {pay.amount.toLocaleString()}원
                            </td>
                            <td style={{ padding: '14px 16px' }}>{pay.manager}</td>
                            <td style={{ padding: '14px 16px' }}>
                              <span className="badge badge-amber">{pay.methodMemo}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 코스 & VOD 콘텐츠 관리 (CMS) */}
        {activeTab === 'cms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {/* Courses Overview & Sequential Toggle */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 className="heading-3 font-serif">개설 코스 및 순차 학습 설정 ({courses.length})</h3>
                  <p className="text-caption">교육과정을 새롭게 추가하거나, 코스별 순차 학습 및 수강료를 관리합니다.</p>
                </div>
                <button 
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowNewCourseModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={15} />
                  <span>새 코스 추가</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {courses.map(course => {
                  const courseLecs = lectures.filter(l => l.courseId === course.id);

                  return (
                    <div key={course.id} className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      {/* Course Thumbnail Banner with Quick Actions */}
                      <div style={{ position: 'relative', height: '160px', backgroundColor: '#1E2022', overflow: 'hidden' }}>
                        <img 
                          src={course.thumbnail} 
                          alt={course.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px' }}>
                          <span className="badge badge-sage" style={{ background: 'rgba(30,32,34,0.85)', color: '#FFFFFF', border: 'none' }}>
                            {course.category}
                          </span>
                        </div>
                        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ 
                              backgroundColor: 'rgba(30,32,34,0.75)', 
                              color: '#F87171', 
                              padding: '5px 8px',
                              borderRadius: '6px',
                              backdropFilter: 'blur(4px)'
                            }}
                            title="코스 삭제"
                            onClick={() => handleDeleteCourse(course.id, course.title)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ 
                            position: 'absolute', 
                            bottom: '10px', 
                            right: '10px', 
                            backgroundColor: 'rgba(30,32,34,0.88)', 
                            color: '#FFFFFF', 
                            border: '1px solid rgba(255,255,255,0.25)', 
                            padding: '5px 12px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            backdropFilter: 'blur(6px)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontWeight: 600,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                          }}
                          onClick={() => handleOpenCourseThumbModal(course)}
                          title="강의 썸네일 수정"
                        >
                          <ImageIcon size={13} />
                          <span>썸네일 수정</span>
                        </button>
                      </div>

                      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <h4 className="heading-3 font-serif" style={{ marginBottom: '8px' }}>{course.title}</h4>
                        
                        <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '14px', lineHeight: '1.6', flex: 1 }}>
                          {course.subtitle || '과정 설명이 등록되지 않았습니다.'}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>수강 인정 기간:</span>
                            <strong>{course.defaultPeriodDays}일 (결제일 기준)</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>수강료:</span>
                            <strong>{Number(course.price || 0).toLocaleString()}원</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>등록 차시:</span>
                            <strong>{courseLecs.length}개 차시</strong>
                          </div>
                          
                          {/* Sequential Unlock Setting Toggle */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)' }}>
                            <div>
                              <span style={{ fontWeight: 600 }}>순차 학습 잠금</span>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>이전 차시 완강 시 다음 차시 열림</div>
                            </div>
                            <button 
                              type="button"
                              className={`btn btn-sm ${course.sequentialUnlock ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => handleToggleSequential(course.id, course.sequentialUnlock)}
                            >
                              {course.sequentialUnlock ? '적용 중 (ON)' : '해제됨 (OFF)'}
                            </button>
                          </div>

                          {/* Certificate Link Information & Quick Edit */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)' }}>
                            <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px' }}>
                                <Award size={14} color="var(--color-amber-dark)" />
                                <span>연동 자격증:</span>
                                <span className="badge badge-amber" style={{ fontSize: '11px', padding: '1px 6px' }}>
                                  {course.certTypeFull || course.certType || (course.id === 'course-ritual-12-15' ? '불교의례법사 1급' : '불교의례법사 2급')}
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                                {course.certRegNo || (course.id === 'course-ritual-12-15' ? '제 2026-법사1급-00100 호' : '제 2026-법사2급-00100 호')}
                              </div>
                            </div>
                            <button 
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11.5px', padding: '4px 8px', whiteSpace: 'nowrap' }}
                              onClick={() => handleOpenCertEditModal(course)}
                              title="코스 수료 시 발급될 자격증 이름 및 등록 번호 양식을 수정합니다."
                            >
                              자격증 설정
                            </button>
                          </div>

                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                              onClick={() => handleOpenCourseThumbModal(course)}
                            >
                              <ImageIcon size={14} />
                              <span>썸네일 이미지 교체 / 편집</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* VOD Lecture List */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <h3 className="heading-3 font-serif">등록된 차시(VOD) 목록 ({lectures.length})</h3>
                  <select
                    className="form-select"
                    style={{ fontSize: '12.5px', padding: '5px 10px', minWidth: '190px' }}
                    value={cmsCourseFilter}
                    onChange={(e) => setCmsCourseFilter(e.target.value)}
                  >
                    <option value="all">-- 전체 코스 차시 보기 --</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowNewLecModal(true)}>
                  <Plus size={14} />
                  <span>새 차시 추가</span>
                </button>
              </div>

              <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-surface-warm)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '12px 16px' }}>소속 코스</th>
                      <th style={{ padding: '12px 16px' }}>차시 순서</th>
                      <th style={{ padding: '12px 16px' }}>강의 제목</th>
                      <th style={{ padding: '12px 16px' }}>재생 시간</th>
                      <th style={{ padding: '12px 16px' }}>첨부 교안(PDF)</th>
                      <th style={{ padding: '12px 16px' }}>동영상 스트리밍 & 관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lectures
                      .filter(lec => cmsCourseFilter === 'all' || lec.courseId === cmsCourseFilter)
                      .map(lec => {
                        const course = courses.find(c => c.id === lec.courseId);
                        const isServerVideo = lec.videoUrl?.includes('supabase.co');

                        return (
                          <tr key={lec.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                              <span className="badge badge-neutral">{course ? course.title.substring(0, 16) : lec.courseId}</span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>{lec.orderIndex}강</td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div 
                                  style={{ 
                                    width: '56px', 
                                    height: '34px', 
                                    borderRadius: '4px', 
                                    overflow: 'hidden', 
                                    backgroundColor: '#1E2022',
                                    flexShrink: 0,
                                    position: 'relative',
                                    border: '1px solid var(--color-border)',
                                    cursor: 'pointer'
                                  }}
                                  title="차시 썸네일 수정"
                                  onClick={() => handleOpenLecThumbModal(lec)}
                                >
                                  <img 
                                    src={lec.thumbnail || course?.thumbnail} 
                                    alt={lec.title} 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                  />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600 }}>{lec.title}</div>
                                  {lec.description && (
                                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
                                      {lec.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px' }}>약 {Math.round(lec.durationSeconds / 60)}분 ({lec.durationSeconds}초)</td>
                            <td style={{ padding: '14px 16px' }}>
                              {lec.attachments && lec.attachments.length > 0 ? (
                                <span className="badge badge-sage">{lec.attachments[0].name}</span>
                              ) : (
                                <span style={{ color: '#94A3B8' }}>없음</span>
                              )}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {isServerVideo ? (
                                  <span className="badge badge-sage" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Shield size={11} />
                                    프라이빗 서버 VOD
                                  </span>
                                ) : (
                                  <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                                    샘플/외부 영상
                                  </span>
                                )}

                                <button 
                                  type="button" 
                                  className="btn btn-secondary btn-sm" 
                                  style={{ padding: '4px 9px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="동영상 미리보기 재생"
                                  onClick={() => setPreviewModalLec(lec)}
                                >
                                  <PlayCircle size={13} />
                                  <span>재생 확인</span>
                                </button>

                                <button 
                                  type="button" 
                                  className="btn btn-primary btn-sm" 
                                  style={{ padding: '4px 9px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="새 동영상 파일로 서버에 직접 업로드/교체"
                                  onClick={() => {
                                    setReplaceModalLec(lec);
                                    setReplaceVideoFile(null);
                                    setReplaceVideoPreviewUrl('');
                                    setReplaceProgress(null);
                                    setReplaceSuccessMsg('');
                                    setReplaceErrorMsg('');
                                  }}
                                >
                                  <UploadCloud size={13} />
                                  <span>영상 교체</span>
                                </button>

                                <button 
                                  type="button" 
                                  className="btn btn-secondary btn-sm" 
                                  style={{ padding: '4px 9px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="차시별 썸네일 포스터 변경"
                                  onClick={() => handleOpenLecThumbModal(lec)}
                                >
                                  <ImageIcon size={13} />
                                  <span>썸네일 수정</span>
                                </button>

                                <button 
                                  type="button" 
                                  className="btn btn-ghost btn-sm" 
                                  style={{ padding: '4px 8px', fontSize: '12px', color: '#DC2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="강의 차시 삭제 (잘못 올린 경우 즉시 제거)"
                                  onClick={() => handleDeleteLecture(lec.id, lec.title)}
                                >
                                  <Trash2 size={13} />
                                  <span>차시 삭제</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {lectures.filter(lec => cmsCourseFilter === 'all' || lec.courseId === cmsCourseFilter).length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#94A3B8' }}>
                          등록된 강의 차시가 없습니다. 우측 상단의 [새 차시 추가]를 눌러 영상을 등록해 보세요.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Q&A Management Panel */}
        {activeTab === 'qa' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
              <div>
                <h3 className="heading-2 font-serif" style={{ fontSize: '20px' }}>
                  학인 학습 질의응답 (Q&A) 통합 관리
                </h3>
                <p className="text-caption">
                  전 강좌 수강생들의 질문을 모니터링하고, 담당 지도 스님/교수님 명의로 자비로운 법문 답변을 등록합니다.
                </p>
              </div>

              {/* Status Filter Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`btn btn-sm ${qaStatusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setQaStatusFilter('all')}
                >
                  전체 질의 ({qaPosts?.length || 0})
                </button>
                <button 
                  className={`btn btn-sm ${qaStatusFilter === 'pending' ? 'btn-amber' : 'btn-secondary'}`}
                  onClick={() => setQaStatusFilter('pending')}
                >
                  답변 대기 ({pendingQaCount})
                </button>
                <button 
                  className={`btn btn-sm ${qaStatusFilter === 'answered' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setQaStatusFilter('answered')}
                >
                  답변 완료 ({(qaPosts?.length || 0) - pendingQaCount})
                </button>
              </div>
            </div>

            {/* Filter Search Bar */}
            <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 2, minWidth: '240px' }}>
                <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', fontSize: '13.5px' }}
                  placeholder="학인 이름, 질문 제목 또는 내용 검색..."
                  value={qaKeyword}
                  onChange={(e) => setQaKeyword(e.target.value)}
                />
              </div>

              <div style={{ flex: 1, minWidth: '200px' }}>
                <select 
                  className="form-select"
                  style={{ fontSize: '13.5px' }}
                  value={qaCourseFilter}
                  onChange={(e) => setQaCourseFilter(e.target.value)}
                >
                  <option value="all">-- 전체 강좌 보기 --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Questions List */}
            {filteredQAPosts.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                <MessageSquare size={32} style={{ margin: '0 auto 10px auto' }} />
                <p>조건에 일치하는 질문 내역이 없습니다.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredQAPosts.map((post) => {
                  const targetCourse = courses.find(c => c.id === post.courseId);
                  const targetLec = lectures.find(l => l.id === post.lectureId);
                  const hasAnswer = post.answers && post.answers.length > 0;
                  const formatTimestamp = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

                  return (
                    <div key={post.id} className="card" style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="badge badge-sage" style={{ fontSize: '11.5px' }}>
                            {targetCourse?.title ? targetCourse.title.substring(0, 18) + '...' : '강좌'}
                          </span>
                          <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                            {targetLec?.orderIndex ? `${targetLec.orderIndex}강` : '차시'}
                          </span>
                          {post.timestampSeconds && (
                            <span className="badge badge-sage" style={{ fontSize: '11.5px' }}>
                              <PlayCircle size={12} />
                              <span>{formatTimestamp(post.timestampSeconds)} 구간</span>
                            </span>
                          )}
                          {hasAnswer ? (
                            <span className="badge badge-sage" style={{ fontSize: '11.5px' }}>
                              <CheckCircle size={12} />
                              <span>답변 완료</span>
                            </span>
                          ) : (
                            <span className="badge badge-amber" style={{ fontSize: '11.5px' }}>
                              <Clock size={12} />
                              <span>답변 대기</span>
                            </span>
                          )}
                          {post.isPrivate && (
                            <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                              <Lock size={12} />
                              <span>비공개</span>
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          <span><strong>{post.authorName}</strong> ({post.authorMemberNo || post.authorId})</span>
                          <span>•</span>
                          <span>{post.createdAt}</span>
                          <button 
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 6px', color: '#94A3B8' }}
                            onClick={() => handleDeleteQA(post.id)}
                            title="질문 삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <h4 className="heading-3" style={{ fontSize: '16px', marginBottom: '6px' }}>
                        {post.title}
                      </h4>
                      <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.6', marginBottom: '14px', whiteSpace: 'pre-wrap' }}>
                        {post.content}
                      </p>

                      {/* Existing Answer preview */}
                      {hasAnswer ? (
                        <div style={{ backgroundColor: 'var(--color-surface-warm)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-amber)', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                              {post.answers[0].authorName} ({post.answers[0].badgeTitle || '지도교수'})
                            </span>
                            <span style={{ color: 'var(--color-text-muted)' }}>{post.answers[0].createdAt}</span>
                          </div>
                          <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
                            {post.answers[0].content}
                          </p>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12.5px', color: 'var(--color-amber-dark)', marginBottom: '10px' }}>
                          * 아직 스님의 답변이 등록되지 않은 대기 상태입니다.
                        </div>
                      )}

                      {/* Reply / Edit Button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-amber btn-sm"
                          style={{ fontSize: '12.5px', padding: '5px 12px' }}
                          onClick={() => handleOpenReplyModal(post)}
                        >
                          <Edit3 size={13} />
                          <span>{hasAnswer ? '답변 수정하기' : '스님 명의로 답변 작성'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Certificate Issue & Verification Register */}
        {activeTab === 'cert' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
              <div>
                <h3 className="heading-2 font-serif" style={{ fontSize: '20px' }}>
                  공인 수료증 발급 및 진위 확인 대장
                </h3>
                <p className="text-caption">
                  전체 완강 학인에게 정식 발급된 수료증 번호 및 직인 내역을 관리하고 대외 진위를 확인합니다.
                </p>
              </div>
            </div>

            {/* Certificate Search Bar */}
            <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', fontSize: '13.5px' }}
                  placeholder="자격증 등록번호(예: 제 2026-법사2급-00100 호), 발급코드(CERT-...), 학번 또는 성명 검색..."
                  value={certKeyword}
                  onChange={(e) => setCertKeyword(e.target.value)}
                />
              </div>
            </div>

            {/* Certificates Table */}
            <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-warm)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '12px 14px' }}>자격증 등록번호</th>
                    <th style={{ padding: '12px 14px' }}>자격 종목 및 등급</th>
                    <th style={{ padding: '12px 14px' }}>취득 학인</th>
                    <th style={{ padding: '12px 14px' }}>고유 학번</th>
                    <th style={{ padding: '12px 14px' }}>이수 강좌명</th>
                    <th style={{ padding: '12px 14px' }}>발급일자</th>
                    <th style={{ padding: '12px 14px' }}>진위 상태</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCertificates.map(cert => (
                    <tr key={cert.certNo} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-charcoal)' }}>
                        <div>{cert.certRegNo || cert.certNo}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 400 }}>{cert.certNo}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className="badge badge-amber" style={{ fontSize: '11px', fontWeight: 700 }}>
                          {cert.certTypeFull || cert.certType || (cert.courseId === 'course-ritual-12-15' ? '불교의례법사 1급' : '불교의례법사 2급')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                        {cert.studentName} <span style={{ color: '#64748B', fontSize: '11.5px' }}>({cert.birthDate})</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '11px' }}>{cert.memberNo}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '12.5px' }}>{cert.courseTitle}</td>
                      <td style={{ padding: '12px 14px', fontSize: '12px' }}>{cert.issuedAt}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className="badge badge-sage" style={{ fontSize: '11px' }}>
                          <CheckCircle size={12} />
                          <span>정식 인가 ({cert.status || 'valid'})</span>
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                          onClick={() => setSelectedCert(cert)}
                        >
                          <Award size={13} color="var(--color-amber)" />
                          <span>자격증 인쇄</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCertificates.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>
                        조회된 수료증 발급 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* 1. Admin Manual User Register Modal */}
      {showNewUserModal && (
        <div className="modal-backdrop" onClick={() => !isSubmittingUser && setShowNewUserModal(false)}>
          <div 
            className="modal-card" 
            style={{ padding: '32px', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span className="badge badge-sage" style={{ marginBottom: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <UserPlus size={13} />
                  관리자 직접 계정 등록
                </span>
                <h2 className="heading-2 font-serif">
                  신규 사용자(수강생/관리자) 직접 등록
                </h2>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '6px' }}
                onClick={() => !isSubmittingUser && setShowNewUserModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-caption" style={{ marginBottom: '22px', lineHeight: '1.6' }}>
              대면 방문, 전화, 서면 원서 접수 등으로 가입하는 학인의 계정을 관리자가 직접 생성합니다. 등록과 동시에 수강 권한 및 대면 수납 장부 기록을 원스톱으로 처리할 수 있습니다.
            </p>

            {userModalError && (
              <div style={{ marginBottom: '18px', padding: '10px 14px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{userModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit}>
              {/* 섹션 1: 인적 사항 */}
              <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-warm)', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '18px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-charcoal)' }}>
                  <Users size={15} style={{ color: 'var(--color-sage)' }} />
                  <span>1. 기본 인적 사항</span>
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">성명 (실명 또는 법명) *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="예: 홍길동, 원행 스님" 
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">생년월일 *</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={newUserForm.birthDate}
                      onChange={(e) => setNewUserForm({ ...newUserForm, birthDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">휴대전화 번호 (1인 1계정) *</label>
                    <input 
                      type="tel" 
                      className="form-input" 
                      placeholder="예: 010-1234-5678" 
                      value={newUserForm.phone}
                      onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>로그인 아이디 *</label>
                      <button 
                        type="button" 
                        className="btn btn-ghost" 
                        style={{ fontSize: '11px', padding: '0 4px', color: 'var(--color-sage)' }}
                        onClick={handleSuggestId}
                      >
                        추천 ID 생성
                      </button>
                    </div>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="예: wonkak01" 
                      value={newUserForm.id}
                      onChange={(e) => setNewUserForm({ ...newUserForm, id: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">회원 구분 (권한)</label>
                    <select 
                      className="form-select"
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    >
                      <option value="student">일반 수강생 (학인)</option>
                      <option value="admin">교학처 교직원 (관리자)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">학번 / 회원 식별번호 (자동 채번)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={newUserForm.memberNo}
                      onChange={(e) => setNewUserForm({ ...newUserForm, memberNo: e.target.value })}
                      placeholder="BUDDHA-2026-XXXXX"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>

              {/* 섹션 2: 비밀번호 설정 */}
              <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-warm)', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '18px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-charcoal)' }}>
                  <KeyRound size={15} style={{ color: 'var(--color-sage)' }} />
                  <span>2. 초기 비밀번호 설정</span>
                </h4>

                <div className="form-group" style={{ marginBottom: '6px' }}>
                  <label className="form-label">임시 비밀번호 (최소 4자 이상) *</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showNewUserPw ? "text" : "password"} 
                      className="form-input" 
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      placeholder="초기 비밀번호 입력 (기본: buddha1234!)"
                      required
                    />
                    <button 
                      type="button" 
                      className="btn btn-ghost"
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', padding: '6px' }}
                      onClick={() => setShowNewUserPw(!showNewUserPw)}
                    >
                      {showNewUserPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <p className="text-caption" style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', margin: 0 }}>
                  * 수강생에게 안내할 임시 비밀번호입니다. 학인이 첫 로그인 후 비밀번호를 변경할 수 있도록 권장해 주세요.
                </p>
              </div>

              {/* 섹션 3: 강좌 수강 권한 및 대면 수납 연계 (선택) */}
              <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-warm)', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-charcoal)', margin: 0 }}>
                    <BookOpen size={15} style={{ color: 'var(--color-sage)' }} />
                    <span>3. 원클릭 강좌 수강 권한 및 수납 연계 (원스톱)</span>
                  </h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={newUserForm.assignCourse}
                      onChange={(e) => setNewUserForm({ ...newUserForm, assignCourse: e.target.checked })}
                      style={{ accentColor: 'var(--color-sage)', width: '16px', height: '16px' }}
                    />
                    <span>강좌 권한 즉시 부여</span>
                  </label>
                </div>

                {newUserForm.assignCourse && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--color-border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">대상 교육과정(코스) *</label>
                        <select 
                          className="form-select"
                          value={newUserForm.courseId}
                          onChange={(e) => handleNewUserCourseChange(e.target.value)}
                        >
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.title} ({c.price?.toLocaleString()}원)</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">수강 상태 *</label>
                        <select 
                          className="form-select"
                          value={newUserForm.status}
                          onChange={(e) => setNewUserForm({ ...newUserForm, status: e.target.value })}
                        >
                          <option value="active">수강중 (대면결제 완료 - 즉시 시청 가능)</option>
                          <option value="pending">결제대기 (수납 미완료 - 시청 대기)</option>
                          <option value="applied">수강신청 접수</option>
                        </select>
                      </div>
                    </div>

                    {newUserForm.status === 'active' && (
                      <div style={{ padding: '12px', backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, marginBottom: '10px' }}>
                          <input 
                            type="checkbox" 
                            checked={newUserForm.recordPayment}
                            onChange={(e) => setNewUserForm({ ...newUserForm, recordPayment: e.target.checked })}
                            style={{ accentColor: 'var(--color-amber)', width: '16px', height: '16px' }}
                          />
                          <span>교학처 대면 수납 장부에도 즉시 등재하기</span>
                        </label>

                        {newUserForm.recordPayment && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '12px' }}>수납 금액 (원)</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                value={newUserForm.paymentAmount}
                                onChange={(e) => setNewUserForm({ ...newUserForm, paymentAmount: e.target.value })}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '12px' }}>결제 메모</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={newUserForm.paymentMethodMemo}
                                onChange={(e) => setNewUserForm({ ...newUserForm, paymentMethodMemo: e.target.value })}
                                placeholder="예: 대면 카드 결제 / 현장 접수"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={() => setShowNewUserModal(false)}
                  disabled={isSubmittingUser}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-sage)', borderColor: 'var(--color-sage)' }}
                  disabled={isSubmittingUser}
                >
                  {isSubmittingUser ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>회원 정보 등록 중...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>회원 직접 등록 완료</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Registration Success Summary Modal */}
      {createdUserInfo && (
        <div className="modal-backdrop" onClick={() => setCreatedUserInfo(null)}>
          <div className="modal-card" style={{ padding: '32px', maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(59, 90, 68, 0.1)', color: 'var(--color-sage)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <CheckCircle2 size={32} />
              </div>
              <h2 className="heading-2 font-serif" style={{ marginBottom: '6px' }}>
                회원 계정이 성공적으로 등록되었습니다!
              </h2>
              <p className="text-caption">
                아래 계정 정보를 학인에게 문자 또는 대면으로 전달해 주시기 바랍니다.
              </p>
            </div>

            <div style={{ backgroundColor: 'var(--color-surface-warm)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '18px', marginBottom: '20px', fontSize: '13.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>성명 / 법명:</span>
                <strong style={{ color: 'var(--color-charcoal)' }}>{createdUserInfo.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>학번 (식별번호):</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-sage)' }}>{createdUserInfo.memberNo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>아이디:</span>
                <strong style={{ fontFamily: 'monospace' }}>{createdUserInfo.id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>초기 비밀번호:</span>
                <strong style={{ color: 'var(--color-amber)', fontFamily: 'monospace' }}>{createdUserInfo.password}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>휴대전화:</span>
                <span>{createdUserInfo.phone}</span>
              </div>
              {createdUserInfo.assignedCourseTitle && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>부여된 수강 강좌:</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-charcoal)', textAlign: 'right', maxWidth: '240px' }}>
                    {createdUserInfo.assignedCourseTitle} ({createdUserInfo.assignedStatusText})
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={handleCopyUserInfo}
              >
                {copiedInfo ? <CheckCheck size={16} color="var(--color-sage)" /> : <Copy size={16} />}
                <span>{copiedInfo ? '안내 문구 복사됨!' : '안내 정보 전체 복사'}</span>
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={() => setCreatedUserInfo(null)}
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Password Reset Modal */}
      {resetPwUser && (
        <div className="modal-backdrop" onClick={() => !isResettingPw && setResetPwUser(null)}>
          <div className="modal-card" style={{ padding: '28px', maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span className="badge badge-amber" style={{ marginBottom: '6px' }}>
                  <KeyRound size={12} />
                  비밀번호 초기화
                </span>
                <h3 className="heading-3 font-serif">
                  {resetPwUser.name} 학인 비밀번호 초기화
                </h3>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '6px' }}
                onClick={() => !isResettingPw && setResetPwUser(null)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-caption" style={{ marginBottom: '18px' }}>
              아이디: <strong>{resetPwUser.id}</strong> | 전화번호: {resetPwUser.phone}
            </p>

            <form onSubmit={handleExecuteResetPassword}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">새 임시 비밀번호 설정 (최소 4자 이상)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  placeholder="예: buddha1234!"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setResetPwUser(null)}
                  disabled={isResettingPw}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn btn-amber" 
                  style={{ flex: 1.2 }}
                  disabled={isResettingPw}
                >
                  {isResettingPw ? '초기화 중...' : '비밀번호 즉시 변경'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grant Enrollment Modal */}
      {showGrantModal && selectedUser && (
        <div className="modal-backdrop" onClick={() => setShowGrantModal(false)}>
          <div className="modal-card" style={{ padding: '28px', maxWidth: '540px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 className="heading-2 font-serif" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={20} color="var(--color-sage)" />
                <span>수강 권한 및 상태 관리</span>
              </h3>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm" 
                onClick={() => setShowGrantModal(false)}
                style={{ padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-caption" style={{ marginBottom: '18px' }}>
              선택한 학인의 현재 권한 현황을 확인하고, 수강 상태를 변경하거나 신규 권한을 부여합니다.
            </p>

            {/* 상단: 현재 권한 및 상태 요약 출력 카드 */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>대상 회원 정보</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-charcoal)', marginTop: '2px' }}>
                    {selectedUser.name} <span style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>({selectedUser.id})</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    ☎ {selectedUser.phone} {selectedUser.memberNo && `| 학번: ${selectedUser.memberNo}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '3px' }}>현재 시스템 권한</span>
                  <span className={`badge ${selectedUser.role === 'admin' ? 'badge-coral' : 'badge-sage'}`} style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 700 }}>
                    {selectedUser.role === 'admin' ? '🛡️ 최고관리자' : '🎓 일반 수강생(학인)'}
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  현재 강좌별 수강 권한 현황:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {courses.map(c => {
                    const enr = enrollments.find(e => e.userId === selectedUser.id && e.courseId === c.id);
                    const statusText = !enr ? '미부여 (수강 권한 없음)' :
                      enr.status === 'active' ? '▶ 수강 중 (결제완료)' :
                      enr.status === 'completed' ? '🏆 수료 완료 (완강)' :
                      enr.status === 'pending' ? '⏳ 대기상태 (결제 대기)' : '수강신청 접수';
                    const badgeBg = !enr ? '#F1F5F9' :
                      enr.status === 'active' ? '#DCFCE7' :
                      enr.status === 'completed' ? '#FEF3C7' : '#FFFBEB';
                    const badgeColor = !enr ? '#94A3B8' :
                      enr.status === 'active' ? '#166534' :
                      enr.status === 'completed' ? '#B45309' : '#D97706';

                    return (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', background: '#FFFFFF', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontWeight: 600, color: '#1E293B' }}>{c.title}</span>
                        <span style={{ background: badgeBg, color: badgeColor, padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700 }}>
                          {statusText}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 권한 수정/부여 폼 */}
            <form onSubmit={handleGrantEnrollment}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-charcoal)', marginBottom: '10px' }}>
                수강 권한 신규 부여 및 상태 변경
              </div>
              <div className="form-group">
                <label className="form-label">대상 코스 선택</label>
                <select 
                  className="form-select"
                  value={grantCourseId}
                  onChange={(e) => setGrantCourseId(e.target.value)}
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">변경할 수강 상태</label>
                <select 
                  className="form-select"
                  value={grantStatus}
                  onChange={(e) => setGrantStatus(e.target.value)}
                >
                  <option value="active">▶ 수강중 (대면 결제 완료 - 즉시 시청 승인)</option>
                  <option value="pending">⏳ 결제대기 (수납 미완료 - 시청 대기)</option>
                  <option value="applied">수강신청 접수</option>
                  <option value="completed">🏆 수료 (전 과정 이수 및 수료증 발급)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowGrantModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }}>
                  권한 승인 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-Person Payment Record Modal */}
      {showPaymentModal && (
        <div className="modal-backdrop" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-card" style={{ padding: '28px' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="heading-2 font-serif" style={{ marginBottom: '8px' }}>
              대면 결제 수납 등록
            </h3>
            <p className="text-caption" style={{ marginBottom: '20px' }}>
              학과 교학처 방문 수납 내역을 기록하고 수강 권한을 활성화합니다.
            </p>

            <form onSubmit={handleRecordPayment}>
              <div className="form-group">
                <label className="form-label">수강생 선택 *</label>
                <select 
                  className="form-select"
                  value={payUserId}
                  onChange={(e) => setPayUserId(e.target.value)}
                  required
                >
                  <option value="">-- 수강생을 선택하세요 --</option>
                  {allUsers.filter(u => u.role !== 'admin').map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.phone}) - {u.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">수납 대상 코스 *</label>
                <select 
                  className="form-select"
                  value={payCourseId}
                  onChange={(e) => setPayCourseId(e.target.value)}
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title} ({c.price?.toLocaleString()}원)</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">수납 금액 (원) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">수납 일자</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">수납 담당자 성명</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={payManager}
                  onChange={(e) => setPayManager(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">결제수단 및 메모</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="예: 대면 카드 결제 (국민 1024), 현금영수증 발급 등"
                  value={payMethodMemo}
                  onChange={(e) => setPayMethodMemo(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPaymentModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-amber" style={{ flex: 1 }}>
                  수납 완료 및 수강 승인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Lecture CMS Modal */}
      {showNewLecModal && (
        <div className="modal-backdrop" onClick={() => !isUploading && setShowNewLecModal(false)}>
          <div className="modal-card" style={{ padding: '32px', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span className="badge badge-sage" style={{ marginBottom: '6px' }}>
                  <Shield size={12} />
                  프라이빗 서버 직접 업로드
                </span>
                <h3 className="heading-2 font-serif">
                  신규 VOD 차시 등록 (CMS)
                </h3>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '6px' }}
                onClick={() => !isUploading && setShowNewLecModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-caption" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
              영상 파일을 선택하면 <strong>프라이빗 클라우드 서버(Supabase Storage)로 직접 안전하게 업로드</strong>되며, 학생 시청 플레이어에 즉시 고화질 스트리밍으로 연동됩니다.
            </p>

            <form onSubmit={handleCreateLecture}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <label className="form-label">소속 코스 *</label>
                  <select 
                    className="form-select"
                    value={lecForm.courseId}
                    onChange={(e) => setLecForm({ ...lecForm, courseId: e.target.value })}
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div style={{ width: '130px' }}>
                  <label className="form-label">차시 순서 (강) *</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={lecForm.orderIndex}
                    onChange={(e) => setLecForm({ ...lecForm, orderIndex: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">강의 제목 *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="예: 4강. 보살행과 일상 속 자비 실천"
                  value={lecForm.title}
                  onChange={(e) => setLecForm({ ...lecForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">강의 상세 설명</label>
                <textarea 
                  className="form-textarea" 
                  rows="2"
                  placeholder="강의 핵심 요약 및 학습 목표"
                  value={lecForm.description}
                  onChange={(e) => setLecForm({ ...lecForm, description: e.target.value })}
                />
              </div>

              {/* Video Source Option Switcher */}
              <div style={{ marginBottom: '18px', padding: '16px', backgroundColor: 'var(--color-surface-warm)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                    동영상 등록 방식
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${uploadMode === 'file' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '12px' }}
                      onClick={() => setUploadMode('file')}
                    >
                      <UploadCloud size={13} />
                      <span>파일 직접 업로드</span>
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${uploadMode === 'url' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '12px' }}
                      onClick={() => setUploadMode('url')}
                    >
                      <ExternalLink size={13} />
                      <span>URL 직접 입력</span>
                    </button>
                  </div>
                </div>

                {/* Direct File Upload Mode */}
                {uploadMode === 'file' ? (
                  <div>
                    <div style={{ padding: '10px 14px', backgroundColor: 'rgba(59, 90, 68, 0.08)', borderRadius: '6px', marginBottom: '12px', fontSize: '12px', color: 'var(--color-sage)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={15} style={{ flexShrink: 0 }} />
                      <span>
                        <strong>웹 원클릭 자동 압축 탑재:</strong> 대용량 원본 영상(100MB~300MB)을 바로 선택하셔도, 웹에서 <strong>1080p 고화질을 유지하며 자동으로 최적화 압축</strong>하여 서버에 등록됩니다.
                      </span>
                    </div>

                    <input 
                      type="file" 
                      ref={newFileInputRef}
                      accept="video/mp4,video/webm,video/ogg,video/quicktime,.mkv,.avi"
                      style={{ display: 'none' }}
                      onChange={(e) => handleNewVideoFileSelect(e.target.files[0])}
                    />

                    {!newVideoFile ? (
                      <div 
                        style={{
                          border: '2px dashed var(--color-sage)',
                          borderRadius: '8px',
                          padding: '32px 20px',
                          textAlign: 'center',
                          backgroundColor: '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => newFileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer.files?.[0]) {
                            handleNewVideoFileSelect(e.dataTransfer.files[0]);
                          }
                        }}
                      >
                        <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', backgroundColor: 'rgba(59, 90, 68, 0.08)', color: 'var(--color-sage)', marginBottom: '10px' }}>
                          <UploadCloud size={32} />
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-text)', marginBottom: '4px' }}>
                          이곳을 클릭하거나 동영상 파일을 끌어다 놓으세요
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                          MP4, MOV, WEBM, MKV 지원 (선택 시 1080p 고화질 자동 압축 및 서버 CDN 업로드)
                        </div>
                      </div>
                    ) : (
                      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '16px', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileVideo size={24} style={{ color: 'var(--color-sage)' }} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{newVideoFile.name}</div>
                              <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                                용량: {(newVideoFile.size / (1024 * 1024)).toFixed(1)} MB | 감지된 길이: 약 {Math.round(lecForm.durationSeconds / 60)}분 ({lecForm.durationSeconds}초)
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => {
                              setNewVideoFile(null);
                              setNewVideoPreviewUrl('');
                              setUploadProgress(null);
                              setUploadSuccessMsg('');
                              setUploadErrorMsg('');
                            }}
                            disabled={isUploading}
                          >
                            파일 변경
                          </button>
                        </div>

                        {/* Local Video Preview Player */}
                        {newVideoPreviewUrl && (
                          <div style={{ marginTop: '12px', marginBottom: '12px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#000' }}>
                            <video 
                              src={newVideoPreviewUrl} 
                              controls 
                              style={{ width: '100%', maxHeight: '180px', display: 'block' }} 
                            />
                          </div>
                        )}

                        {/* Upload Progress Bar */}
                        {isUploading && uploadProgress && (
                          <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--color-surface-warm)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Loader2 size={15} className="spin" style={{ color: 'var(--color-sage)' }} />
                                {uploadProgress.step === 'processing'
                                  ? '1080p 고화질 자동 최적화 압축 진행 중...'
                                  : '서버로 영상 원본 파일 전송 중...'}
                              </span>
                              <span style={{ fontWeight: 700, color: 'var(--color-sage)', fontSize: '12px' }}>
                                {uploadProgress.step === 'processing' 
                                  ? `최적화 중 (${uploadProgress.compressSec || 0}초 경과)` 
                                  : `${uploadProgress.percent}% (${uploadProgress.speed})`}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  width: `${uploadProgress.percent}%`, 
                                  height: '100%', 
                                  backgroundColor: 'var(--color-sage)',
                                  opacity: uploadProgress.step === 'processing' ? 0.85 : 1,
                                  transition: 'width 0.2s ease'
                                }} 
                              />
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>
                                {uploadProgress.step === 'processing'
                                  ? '💡 슬라이드 글자 가독성을 100% 보존하며 용량을 ~85% 감축 중입니다'
                                  : '클라우드 저장소 업로드를 준비하고 있습니다'}
                              </span>
                              <span>
                                {uploadProgress.step === 'processing'
                                  ? '창을 닫지 마세요'
                                  : `${(uploadProgress.loaded / (1024 * 1024)).toFixed(1)} MB / ${(uploadProgress.total / (1024 * 1024)).toFixed(1)} MB`}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Success Notice */}
                        {uploadSuccessMsg && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: 'rgba(59, 90, 68, 0.1)', color: 'var(--color-sage)', borderRadius: '6px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle size={15} />
                            <span>{uploadSuccessMsg}</span>
                          </div>
                        )}

                        {/* Error Notice */}
                        {uploadErrorMsg && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '6px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={15} />
                            <span>{uploadErrorMsg}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="https://... 또는 스트리밍 mp4 URL"
                      value={lecForm.videoUrl}
                      onChange={(e) => setLecForm({ ...lecForm, videoUrl: e.target.value })}
                    />
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      외부 CDN 주소나 MP4 동영상 스트리밍 URL을 직접 지정할 수 있습니다.
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">강의 재생 시간 (초 단위)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={lecForm.durationSeconds}
                    onChange={(e) => setLecForm({ ...lecForm, durationSeconds: Number(e.target.value) })}
                    required
                  />
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    약 {Math.round(lecForm.durationSeconds / 60)}분 {lecForm.durationSeconds % 60}초 (영상 파일 선택 시 자동 감지)
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label className="form-label">강의 교재 첨부파일명 (PDF)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={lecForm.attachmentName}
                    onChange={(e) => setLecForm({ ...lecForm, attachmentName: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={() => setShowNewLecModal(false)}
                  disabled={isUploading}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>
                        {uploadProgress?.step === 'processing'
                          ? `1080p 최적화 압축 중 (${uploadProgress?.compressSec || 0}초 경과)...`
                          : `서버로 업로드 등록 중... (${uploadProgress?.percent || 0}%)`}
                      </span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} />
                      <span>프라이빗 서버로 업로드 및 차시 등록 완료</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Existing Lecture Video Replace Modal */}
      {replaceModalLec && (
        <div className="modal-backdrop" onClick={() => !isReplacing && setReplaceModalLec(null)}>
          <div className="modal-card" style={{ padding: '30px', maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span className="badge badge-sage" style={{ marginBottom: '6px' }}>
                  <UploadCloud size={12} />
                  서버 스토리지 영상 교체
                </span>
                <h3 className="heading-2 font-serif">
                  차시 동영상 파일 교체 업로드
                </h3>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '6px' }}
                onClick={() => !isReplacing && setReplaceModalLec(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-surface-warm)', borderRadius: '6px', marginBottom: '18px', fontSize: '13px' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                대상 강좌: [{courses.find(c => c.id === replaceModalLec.courseId)?.title}] {replaceModalLec.orderIndex}강. {replaceModalLec.title}
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '11.5px', wordBreak: 'break-all' }}>
                현재 소스 URL: {replaceModalLec.videoUrl}
              </div>
            </div>

            <form onSubmit={handleReplaceVideoSubmit}>
              <div style={{ padding: '10px 14px', backgroundColor: 'rgba(59, 90, 68, 0.08)', borderRadius: '6px', marginBottom: '14px', fontSize: '12px', color: 'var(--color-sage)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={15} style={{ flexShrink: 0 }} />
                <span>
                  <strong>웹 원클릭 자동 압축 탑재:</strong> 대용량 원본 파일도 선택 즉시 1080p 고화질을 보존하며 자동으로 최적화 압축되어 교체됩니다.
                </span>
              </div>

              <input 
                type="file" 
                ref={replaceFileInputRef}
                accept="video/mp4,video/webm,video/ogg,video/quicktime,.mkv,.avi"
                style={{ display: 'none' }}
                onChange={(e) => handleReplaceVideoFileSelect(e.target.files[0])}
              />

              {!replaceVideoFile ? (
                <div 
                  style={{
                    border: '2px dashed var(--color-sage)',
                    borderRadius: '8px',
                    padding: '30px 20px',
                    textAlign: 'center',
                    backgroundColor: '#FFFFFF',
                    cursor: 'pointer'
                  }}
                  onClick={() => replaceFileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files?.[0]) {
                      handleReplaceVideoFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'rgba(59, 90, 68, 0.08)', color: 'var(--color-sage)', marginBottom: '8px' }}>
                    <UploadCloud size={28} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '14.5px', marginBottom: '4px' }}>
                    교체할 새 동영상 파일을 선택하거나 끌어다 놓으세요
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    MP4, MOV, WEBM 지원 (업로드 즉시 프라이빗 서버에 저장되고 교체됩니다)
                  </div>
                </div>
              ) : (
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '16px', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileVideo size={24} style={{ color: 'var(--color-sage)' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{replaceVideoFile.name}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                          용량: {(replaceVideoFile.size / (1024 * 1024)).toFixed(1)} MB
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setReplaceVideoFile(null);
                        setReplaceVideoPreviewUrl('');
                        setReplaceProgress(null);
                      }}
                      disabled={isReplacing}
                    >
                      파일 변경
                    </button>
                  </div>

                  {replaceVideoPreviewUrl && (
                    <div style={{ marginTop: '12px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#000' }}>
                      <video 
                        src={replaceVideoPreviewUrl} 
                        controls 
                        style={{ width: '100%', maxHeight: '160px', display: 'block' }} 
                      />
                    </div>
                  )}

                  {isReplacing && replaceProgress && (
                    <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--color-surface-warm)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Loader2 size={15} className="spin" style={{ color: 'var(--color-sage)' }} />
                          {replaceProgress.step === 'processing'
                            ? '1080p 고화질 자동 최적화 압축 진행 중...'
                            : '서버로 영상 원본 파일 전송 중...'}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--color-sage)', fontSize: '12px' }}>
                          {replaceProgress.step === 'processing' 
                            ? `최적화 중 (${replaceProgress.compressSec || 0}초 경과)` 
                            : `${replaceProgress.percent}% (${replaceProgress.speed})`}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${replaceProgress.percent}%`, 
                            height: '100%', 
                            backgroundColor: 'var(--color-sage)',
                            opacity: replaceProgress.step === 'processing' ? 0.85 : 1,
                            transition: 'width 0.2s ease'
                          }} 
                        />
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>
                          {replaceProgress.step === 'processing'
                            ? '💡 슬라이드 글자 가독성을 100% 보존하며 용량을 ~85% 감축 중입니다'
                            : '클라우드 저장소 업로드를 준비하고 있습니다'}
                        </span>
                        <span>
                          {replaceProgress.step === 'processing'
                            ? '창을 닫지 마세요'
                            : `${(replaceProgress.loaded / (1024 * 1024)).toFixed(1)} MB / ${(replaceProgress.total / (1024 * 1024)).toFixed(1)} MB`}
                        </span>
                      </div>
                    </div>
                  )}

                  {replaceSuccessMsg && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: 'rgba(59, 90, 68, 0.1)', color: 'var(--color-sage)', borderRadius: '6px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={15} />
                      <span>{replaceSuccessMsg}</span>
                    </div>
                  )}

                  {replaceErrorMsg && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '6px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={15} />
                      <span>{replaceErrorMsg}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={() => setReplaceModalLec(null)}
                  disabled={isReplacing}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                  disabled={isReplacing || !replaceVideoFile}
                >
                  {isReplacing ? (
                    <>
                      <Loader2 size={15} className="spin" />
                      <span>
                        {replaceProgress?.step === 'processing'
                          ? `1080p 최적화 압축 중 (${replaceProgress?.compressSec || 0}초 경과)...`
                          : `서버로 업로드 중 (${replaceProgress?.percent || 0}%)...`}
                      </span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={15} />
                      <span>서버로 업로드 및 교체 완료</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

            {/* New Course Modal */}
      {showNewCourseModal && (
        <div className="modal-backdrop" onClick={() => setShowNewCourseModal(false)}>
          <div className="modal-card" style={{ padding: '30px', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span className="badge badge-sage" style={{ marginBottom: '6px' }}>
                  <BookOpen size={12} />
                  신규 교육과정 개설
                </span>
                <h3 className="heading-2 font-serif">
                  새 교육과정(코스) 추가
                </h3>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '6px' }}
                onClick={() => setShowNewCourseModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCourse}>
              <div className="form-group">
                <label className="form-label">코스 제목 (필수)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="예: 불교의례법사 과정 III (16강~19강)"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">코스 부제목 / 핵심 요약</label>
                <textarea 
                  className="form-textarea" 
                  rows="2"
                  placeholder="예: 생전예수재 및 영산재 실습을 체계적으로 익히는 심화 의례 과정"
                  value={courseForm.subtitle}
                  onChange={(e) => setCourseForm({ ...courseForm, subtitle: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">카테고리</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="예: 불교의례법사"
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">담당 교수 / 법사</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="예: 불교의례 전문 법사"
                    value={courseForm.instructor}
                    onChange={(e) => setCourseForm({ ...courseForm, instructor: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">수강 인정 기간 (일 단위)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={courseForm.defaultPeriodDays}
                    onChange={(e) => setCourseForm({ ...courseForm, defaultPeriodDays: Number(e.target.value) })}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">수강료 (원 단위)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={courseForm.price}
                    onChange={(e) => setCourseForm({ ...courseForm, price: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              {/* Thumbnail Image Selection for New Course */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>강좌 대표 썸네일 이미지</span>
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>파일 업로드 또는 웹 URL 입력</span>
                </label>
                
                {/* Thumbnail Preview */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ width: '120px', height: '68px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#1E2022', border: '1px solid var(--color-border)', flexShrink: 0 }}>
                    <img 
                      src={courseForm.thumbnail} 
                      alt="Thumbnail Preview" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Upload size={13} />
                        <span>내 PC 이미지 선택</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const res = await uploadThumbnailImage(file);
                                setCourseForm(prev => ({ ...prev, thumbnail: res.publicUrl }));
                              } catch (err) {
                                showAlert(`이미지 처리 오류: ${err.message}`, { type: 'error', title: '이미지 오류' });
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ fontSize: '12px', padding: '6px 10px' }}
                      placeholder="https://... 이미지 웹 주소"
                      value={courseForm.thumbnail}
                      onChange={(e) => setCourseForm({ ...courseForm, thumbnail: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                <input 
                  type="checkbox"
                  id="seqUnlockCheck"
                  checked={courseForm.sequentialUnlock}
                  onChange={(e) => setCourseForm({ ...courseForm, sequentialUnlock: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--color-sage)' }}
                />
                <label htmlFor="seqUnlockCheck" style={{ fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }}>
                  순차 학습 잠금 적용 (이전 차시 100% 수강 완료 시 다음 차시 열림)
                </label>
              </div>

              {/* Course Certificate (Qualification) Settings */}
              <div style={{ 
                background: 'var(--color-surface-warm)', 
                border: '1.5px solid rgba(212, 155, 75, 0.4)', 
                borderRadius: '8px', 
                padding: '16px 18px', 
                marginTop: '16px',
                marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={18} color="var(--color-amber-dark)" />
                    <strong style={{ fontSize: '14.5px', color: 'var(--color-charcoal)' }}>
                      공인 민간자격증 발급 연동 정보
                    </strong>
                  </div>
                  <span className="badge badge-amber" style={{ fontSize: '11px', fontWeight: 600 }}>수료 시 자동 발급</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label className="form-label">
                      자격증 이름 / 종목명 (필수)
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="예: 불교의례법사, 불교의례지도사, 선명상지도사"
                      value={courseForm.certType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCourseForm(prev => ({
                          ...prev,
                          certType: val,
                          certTypeFull: `${val} ${prev.certGrade || ''}`.trim()
                        }));
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">자격 등급</label>
                    <select 
                      className="form-select"
                      value={courseForm.certGrade}
                      onChange={(e) => {
                        const grade = e.target.value;
                        setCourseForm(prev => ({
                          ...prev,
                          certGrade: grade,
                          certTypeFull: `${prev.certType || '불교의례법사'} ${grade}`.trim()
                        }));
                      }}
                    >
                      <option value="1급">1급</option>
                      <option value="2급">2급</option>
                      <option value="3급">3급</option>
                      <option value="전문과정">전문과정</option>
                      <option value="지도사">지도사</option>
                      <option value="단일과정">단일과정</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label className="form-label">
                    자격증 번호 (수료증 발급 등록번호 양식)
                  </label>
                  <input 
                    type="text" 
                    className="form-input font-mono" 
                    placeholder="예: 제 2026-법사2급-0001 호 또는 제 2026-의례지도사-0001 호"
                    value={courseForm.certRegNo}
                    onChange={(e) => setCourseForm(prev => ({ ...prev, certRegNo: e.target.value }))}
                  />
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px', lineHeight: '1.4' }}>
                    * 학인이 코스를 완강하면 본 등록번호 양식과 고유 일련번호가 자동 부여되어 공인 자격증 및 진위확인 시스템에 공식 등록됩니다.
                  </div>
                </div>

                <div>
                  <label className="form-label">주무부처 및 등록 고시</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ fontSize: '12px' }}
                    value={courseForm.certRegOffice}
                    onChange={(e) => setCourseForm(prev => ({ ...prev, certRegOffice: e.target.value }))}
                  />
                </div>

                {/* Online Exam Questions Configuration */}
                {(() => {
                  const parsedQuestions = parseExamText(courseForm.rawExamText || '');
                  return (
                    <div style={{ marginTop: '16px', padding: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileText size={16} color="var(--color-sage)" />
                          <label className="form-label" style={{ margin: 0, fontWeight: 700, color: 'var(--color-charcoal)' }}>
                            온라인 자격 검정 시험 문제 등록 (20~50문항)
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <label 
                            className="btn btn-secondary btn-sm" 
                            style={{ margin: 0, cursor: 'pointer', fontSize: '11.5px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Upload size={12} />
                            <span>.txt 파일 불러오기</span>
                            <input 
                              type="file" 
                              accept=".txt,text/plain" 
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleExamFileUpload(e.target.files[0], setCourseForm);
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '11.5px', padding: '4px 8px', color: 'var(--color-sage)' }}
                            onClick={() => setCourseForm(prev => ({ ...prev, rawExamText: DEFAULT_RAW_EXAM_TEXT }))}
                          >
                            기본 20문항 채우기
                          </button>
                          {courseForm.rawExamText && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '11.5px', padding: '4px 8px', color: '#EF4444' }}
                              onClick={() => setCourseForm(prev => ({ ...prev, rawExamText: '' }))}
                            >
                              비우기
                            </button>
                          )}
                        </div>
                      </div>

                      <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                        * 문제 번호, 4지선다 보기(①~④), 하단 정답과 해설(예: <code>1. ② — 해설</code>)이 포함된 텍스트 파일을 넣으시면 자동 파싱됩니다.<br />
                        * 등록된 문제 풀에서 무작위 <strong>20문제가 문항당 5점(총 100점 만점)</strong>으로 랜덤 출제되며, <strong>60점 이상 합격 시 자격증이 발급</strong>됩니다.
                      </p>

                      <textarea
                        className="form-textarea font-mono"
                        rows={8}
                        style={{ width: '100%', fontSize: '12px', lineHeight: '1.5', resize: 'vertical' }}
                        placeholder="1. 문제 제목\n  ① 보기 1\n  ② 보기 2\n  ③ 보기 3\n  ④ 보기 4\n\n1. ② — 정답 해설..."
                        value={courseForm.rawExamText}
                        onChange={(e) => setCourseForm(prev => ({ ...prev, rawExamText: e.target.value }))}
                      />

                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <div>
                          {parsedQuestions.length >= 20 ? (
                            <span style={{ fontSize: '12px', color: '#166534', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={14} color="#16A34A" />
                              총 {parsedQuestions.length}개 문항 파싱 완료 (랜덤 20문제 출제 조건 충족)
                            </span>
                          ) : parsedQuestions.length > 0 ? (
                            <span style={{ fontSize: '12px', color: '#D97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={14} color="#F59E0B" />
                              현재 {parsedQuestions.length}개 문항 파싱됨 (20~50문항 입력을 권장합니다)
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                              문제를 입력하시면 문항 수와 정답이 자동 감지됩니다.
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                          배점: 문항당 5점 (수료 기준: 60점 이상)
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={() => setShowNewCourseModal(false)}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} />
                  <span>새 코스 등록 완료</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Existing Course Certificate Settings Edit Modal */}
      {certEditCourse && (
        <div className="modal-backdrop" onClick={() => setCertEditCourse(null)}>
          <div className="modal-card" style={{ padding: '28px', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span className="badge badge-amber" style={{ marginBottom: '6px' }}>
                  <Award size={12} />
                  코스 자격증 발급 정보 설정
                </span>
                <h3 className="heading-2 font-serif" style={{ fontSize: '20px' }}>
                  [{certEditCourse.title}]
                </h3>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '6px' }}
                onClick={() => setCertEditCourse(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCertEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label className="form-label">자격증 이름 / 종목명</label>
                  <input 
                    type="text"
                    className="form-input"
                    value={certEditForm.certType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCertEditForm(prev => ({
                        ...prev,
                        certType: val,
                        certTypeFull: `${val} ${prev.certGrade || ''}`.trim()
                      }));
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">자격 등급</label>
                  <select 
                    className="form-select"
                    value={certEditForm.certGrade}
                    onChange={(e) => {
                      const grade = e.target.value;
                      setCertEditForm(prev => ({
                        ...prev,
                        certGrade: grade,
                        certTypeFull: `${prev.certType || ''} ${grade}`.trim()
                      }));
                    }}
                  >
                    <option value="1급">1급</option>
                    <option value="2급">2급</option>
                    <option value="3급">3급</option>
                    <option value="전문과정">전문과정</option>
                    <option value="지도사">지도사</option>
                    <option value="단일과정">단일과정</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">자격증 번호 (수료증 발급 등록번호 양식)</label>
                <input 
                  type="text"
                  className="form-input font-mono"
                  value={certEditForm.certRegNo}
                  onChange={(e) => setCertEditForm(prev => ({ ...prev, certRegNo: e.target.value }))}
                  required
                />
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                  예: 제 2026-법사2급-0001 호 (수료생 고유 일련번호가 0001부터 자동 매핑됩니다)
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">주무부처 및 등록 정보</label>
                <input 
                  type="text"
                  className="form-input"
                  style={{ fontSize: '12.5px' }}
                  value={certEditForm.certRegOffice}
                  onChange={(e) => setCertEditForm(prev => ({ ...prev, certRegOffice: e.target.value }))}
                />
              </div>

              {/* Online Exam Questions Configuration */}
              {(() => {
                const parsedQuestions = parseExamText(certEditForm.rawExamText || '');
                return (
                  <div style={{ marginBottom: '20px', padding: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={16} color="var(--color-amber)" />
                        <label className="form-label" style={{ margin: 0, fontWeight: 700, color: 'var(--color-charcoal)' }}>
                          온라인 자격 검정 시험 문제 관리 (20~50문항)
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <label 
                          className="btn btn-secondary btn-sm" 
                          style={{ margin: 0, cursor: 'pointer', fontSize: '11.5px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Upload size={12} />
                          <span>.txt 파일 불러오기</span>
                          <input 
                            type="file" 
                            accept=".txt,text/plain" 
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleExamFileUpload(e.target.files[0], setCertEditForm);
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '11.5px', padding: '4px 8px', color: 'var(--color-sage)' }}
                          onClick={() => setCertEditForm(prev => ({ ...prev, rawExamText: DEFAULT_RAW_EXAM_TEXT }))}
                        >
                          기본 20문항 채우기
                        </button>
                        {certEditForm.rawExamText && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '11.5px', padding: '4px 8px', color: '#EF4444' }}
                            onClick={() => setCertEditForm(prev => ({ ...prev, rawExamText: '' }))}
                          >
                            비우기
                          </button>
                        )}
                      </div>
                    </div>

                    <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                      * 문제 본문, 4지선다 보기(①~④), 하단 정답 및 해설(예: <code>1. ② — 해설</code>) 텍스트를 입력하시면 자동 파싱됩니다.<br />
                      * 완강 시 등록된 전체 문항 중 <strong>20문제가 랜덤 추출되어 문항당 5점(총 100점 만점)</strong>으로 출제되며 <strong>60점 이상 합격</strong>해야 수료증이 지급됩니다.
                    </p>

                    <textarea
                      className="form-textarea font-mono"
                      rows={8}
                      style={{ width: '100%', fontSize: '12px', lineHeight: '1.5', resize: 'vertical' }}
                      placeholder="1. 문제 제목\n  ① 보기 1\n  ② 보기 2\n  ③ 보기 3\n  ④ 보기 4\n\n1. ② — 정답 해설..."
                      value={certEditForm.rawExamText}
                      onChange={(e) => setCertEditForm(prev => ({ ...prev, rawExamText: e.target.value }))}
                    />

                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div>
                        {parsedQuestions.length >= 20 ? (
                          <span style={{ fontSize: '12px', color: '#166534', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} color="#16A34A" />
                            총 {parsedQuestions.length}개 문항 파싱 완료 (랜덤 20문제 출제 조건 충족)
                          </span>
                        ) : parsedQuestions.length > 0 ? (
                          <span style={{ fontSize: '12px', color: '#D97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={14} color="#F59E0B" />
                            현재 {parsedQuestions.length}개 문항 파싱됨 (20~50문항 입력을 권장합니다)
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                            문제를 입력하시면 문항 수와 정답이 자동 감지됩니다.
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                        배점: 문항당 5점 (수료 기준: 60점 이상)
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setCertEditCourse(null)}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn btn-amber" 
                  style={{ flex: 1.5, fontWeight: 700 }}
                >
                  자격증 설정 저장 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Live Preview Modal */}
      {previewModalLec && (
        <div className="modal-backdrop" onClick={() => setPreviewModalLec(null)}>
          <div className="modal-card" style={{ padding: '24px', maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span className="badge badge-sage" style={{ marginBottom: '6px' }}>
                  {previewModalLec.videoUrl?.includes('supabase.co') ? '프라이빗 서버 VOD' : '외부/샘플 영상'}
                </span>
                <h3 className="heading-3 font-serif">
                  {previewModalLec.orderIndex}강. {previewModalLec.title}
                </h3>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '6px' }}
                onClick={() => setPreviewModalLec(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000', marginBottom: '14px' }}>
              <video 
                src={previewModalLec.videoUrl} 
                controls 
                autoPlay 
                style={{ width: '100%', maxHeight: '380px', display: 'block' }} 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              <div>재생 시간: 약 {Math.round(previewModalLec.durationSeconds / 60)}분 ({previewModalLec.durationSeconds}초)</div>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewModalLec(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Answer Reply Modal */}
      {replyModalPost && (
        <div className="modal-backdrop" onClick={() => setReplyModalPost(null)}>
          <div className="modal-card" style={{ padding: '28px', maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="heading-2 font-serif" style={{ marginBottom: '6px' }}>
              스님/교수님 명의 법문 답변 등록
            </h3>
            <p className="text-caption" style={{ marginBottom: '16px' }}>
              질문자: <strong>{replyModalPost.authorName}</strong> 법우님 | 제목: {replyModalPost.title}
            </p>

            <form onSubmit={handleSaveAdminAnswer}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label className="form-label">답변 스님/교수 선택 *</label>
                  <select 
                    className="form-select"
                    value={replyMonkName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReplyMonkName(val);
                      setReplyBadgeTitle(val.includes('원명') ? '불교학술원 원장' : '담당 지도교수');
                    }}
                  >
                    <option value="지산 스님">지산 스님 (동국불교아카데미 교수)</option>
                    <option value="원명 스님">원명 스님 (불교학술원 원장)</option>
                    <option value="교학처 학술위원">교학처 학술위원</option>
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label className="form-label">직책 / 호칭 *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={replyBadgeTitle}
                    onChange={(e) => setReplyBadgeTitle(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">법문 답변 내용 *</label>
                <textarea 
                  className="form-textarea" 
                  rows="7"
                  placeholder="학인의 질문에 대한 자비로운 법문과 상세한 가르침을 정성껏 작성해 주세요."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setReplyModalPost(null)}>
                  취소
                </button>
                <button type="submit" className="btn btn-amber" style={{ flex: 1 }}>
                  답변 게시 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Certificate Modal for Admin inspection */}
      {selectedCert && (
        <CertificateModal
          certificate={selectedCert}
          onClose={() => setSelectedCert(null)}
        />
      )}

      {/* Course Thumbnail Edit Modal */}
      {thumbModalCourse && (
        <div className="modal-backdrop" onClick={() => !isUploadingThumb && setThumbModalCourse(null)}>
          <div 
            className="modal-card" 
            style={{ padding: '28px', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span className="badge badge-sage" style={{ marginBottom: '6px' }}>
                  <ImageIcon size={12} />
                  강좌 대표 썸네일 관리
                </span>
                <h3 className="heading-2 font-serif">
                  [{thumbModalCourse.title}] 썸네일 수정
                </h3>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '6px' }}
                onClick={() => !isUploadingThumb && setThumbModalCourse(null)}
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-caption" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
              학습자 메인 홈 화면, 수강생 대시보드 카드 및 상세 안내 페이지에 대표 이미지로 노출됩니다.
            </p>

            {/* Live Preview Card */}
            <div style={{ marginBottom: '22px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} style={{ color: 'var(--color-amber)' }} />
                <span>실시간 적용 미리보기 (16:9 비율)</span>
              </label>
              <div 
                style={{ 
                  position: 'relative', 
                  width: '100%', 
                  height: '210px', 
                  borderRadius: '10px', 
                  overflow: 'hidden', 
                  backgroundColor: '#1E2022',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  border: '1px solid var(--color-border)'
                }}
              >
                <img 
                  src={thumbPreviewUrl || thumbModalCourse.thumbnail} 
                  alt="Thumbnail Live Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?auto=format&fit=crop&w=800&q=80';
                  }}
                />
                <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px' }}>
                  <span className="badge badge-sage" style={{ background: 'rgba(30,32,34,0.85)', color: '#FFFFFF', border: 'none' }}>
                    {thumbModalCourse.category}
                  </span>
                </div>
                <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', padding: '16px 12px 6px 12px', borderRadius: '0 0 8px 8px' }}>
                  <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '15px' }}>
                    {thumbModalCourse.title}
                  </div>
                </div>
              </div>
            </div>

            {/* Method 1: File Upload */}
            <div className="card" style={{ padding: '16px', marginBottom: '16px', backgroundColor: 'var(--color-surface-warm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 600, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Upload size={15} style={{ color: 'var(--color-sage)' }} />
                  <span>내 컴퓨터에서 새 이미지 파일 업로드</span>
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>JPG, PNG, WebP 지원</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="file" 
                  ref={courseThumbFileInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCourseThumbFileSelect(file);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => courseThumbFileInputRef.current?.click()}
                  disabled={isUploadingThumb}
                >
                  {isUploadingThumb ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                  <span>{isUploadingThumb ? '이미지 최적화 중...' : '이미지 파일 선택'}</span>
                </button>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  선택 시 1200px 고화질로 자동 최적화 및 압축 저장됩니다.
                </span>
              </div>
            </div>

            {/* Method 2: Direct URL Input */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">이미지 웹 URL 직접 지정</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="https://... 이미지 웹 주소 입력"
                  value={thumbUrlInput}
                  onChange={(e) => {
                    setThumbUrlInput(e.target.value);
                    setThumbPreviewUrl(e.target.value);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setThumbPreviewUrl(thumbUrlInput)}
                >
                  미리보기
                </button>
              </div>
            </div>

            {/* Status Messages */}
            {thumbSuccessMsg && (
              <div style={{ marginBottom: '14px', padding: '8px 12px', backgroundColor: 'rgba(59, 90, 68, 0.1)', color: 'var(--color-sage)', borderRadius: '6px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={15} />
                <span>{thumbSuccessMsg}</span>
              </div>
            )}
            {thumbErrorMsg && (
              <div style={{ marginBottom: '14px', padding: '8px 12px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '6px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} />
                <span>{thumbErrorMsg}</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                onClick={() => setThumbModalCourse(null)}
                disabled={isUploadingThumb}
              >
                취소
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ flex: 1.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                onClick={handleSaveCourseThumbnail}
                disabled={isUploadingThumb}
              >
                <Check size={16} />
                <span>썸네일 변경 저장 완료</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lecture Thumbnail Edit Modal */}
      {thumbModalLec && (
        <div className="modal-backdrop" onClick={() => !isUploadingLecThumb && setThumbModalLec(null)}>
          <div 
            className="modal-card" 
            style={{ padding: '28px', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span className="badge badge-sage" style={{ marginBottom: '6px' }}>
                  <Film size={12} />
                  차시 VOD 썸네일 포스터 관리
                </span>
                <h3 className="heading-2 font-serif">
                  {thumbModalLec.orderIndex}강. {thumbModalLec.title}
                </h3>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '6px' }}
                onClick={() => !isUploadingLecThumb && setThumbModalLec(null)}
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-caption" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
              영상 시청 플레이어 시작 전 커버 포스터 및 차시 목록 미리보기로 표시됩니다.
            </p>

            {/* Live Preview Card */}
            <div style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} style={{ color: 'var(--color-amber)' }} />
                <span>차시 포스터 실시간 미리보기</span>
              </label>
              <div 
                style={{ 
                  position: 'relative', 
                  width: '100%', 
                  height: '190px', 
                  borderRadius: '8px', 
                  overflow: 'hidden', 
                  backgroundColor: '#1E2022',
                  border: '1px solid var(--color-border)'
                }}
              >
                <img 
                  src={thumbLecPreviewUrl || courses.find(c => c.id === thumbModalLec.courseId)?.thumbnail} 
                  alt="Lecture Thumbnail Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                  <span className="badge badge-sage" style={{ background: 'rgba(30,32,34,0.85)', color: '#FFFFFF', border: 'none' }}>
                    {thumbModalLec.orderIndex}강 차시
                  </span>
                </div>
              </div>
            </div>

            {/* Method 1: File Upload */}
            <div className="card" style={{ padding: '16px', marginBottom: '16px', backgroundColor: 'var(--color-surface-warm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Upload size={15} style={{ color: 'var(--color-sage)' }} />
                  <span>내 컴퓨터에서 포스터 이미지 선택</span>
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>JPG, PNG, WebP</span>
              </div>
              <input 
                type="file" 
                ref={lecThumbFileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLecThumbFileSelect(file);
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => lecThumbFileInputRef.current?.click()}
                disabled={isUploadingLecThumb}
              >
                {isUploadingLecThumb ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                <span>{isUploadingLecThumb ? '이미지 최적화 중...' : '이미지 파일 선택'}</span>
              </button>
            </div>

            {/* Method 2: Direct URL Input */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">이미지 URL 직접 입력</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="https://..."
                  value={thumbLecUrlInput}
                  onChange={(e) => {
                    setThumbLecUrlInput(e.target.value);
                    setThumbLecPreviewUrl(e.target.value);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const c = courses.find(item => item.id === thumbModalLec.courseId);
                    if (c?.thumbnail) {
                      setThumbLecUrlInput(c.thumbnail);
                      setThumbLecPreviewUrl(c.thumbnail);
                    }
                  }}
                >
                  코스 썸네일과 동일
                </button>
              </div>
            </div>

            {thumbLecSuccessMsg && (
              <div style={{ marginBottom: '14px', padding: '8px 12px', backgroundColor: 'rgba(59, 90, 68, 0.1)', color: 'var(--color-sage)', borderRadius: '6px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={15} />
                <span>{thumbLecSuccessMsg}</span>
              </div>
            )}
            {thumbLecErrorMsg && (
              <div style={{ marginBottom: '14px', padding: '8px 12px', backgroundColor: '#FEE2E2', color: '#DC2626', borderRadius: '6px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} />
                <span>{thumbLecErrorMsg}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                onClick={() => setThumbModalLec(null)}
                disabled={isUploadingLecThumb}
              >
                취소
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ flex: 1.5 }}
                onClick={handleSaveLecThumbnail}
                disabled={isUploadingLecThumb}
              >
                차시 썸네일 저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
