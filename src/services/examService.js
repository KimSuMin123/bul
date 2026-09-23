// Exam Service - Pure Supabase & Memory Data Flow

/**
 * 텍스트 파일 내용을 문제 및 정답/해설 데이터로 파싱
 */
export function parseExamText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const text = rawText.replace(/\r\n/g, '\n');
  const answerSectionRegex = /\n(?=\s*1\.\s*[①-⑤1-5]\s*[—\-–])/;
  let questionPart = text;
  let answerPart = '';

  const splitIdx = text.search(answerSectionRegex);
  if (splitIdx !== -1) {
    questionPart = text.slice(0, splitIdx).trim();
    answerPart = text.slice(splitIdx).trim();
  }

  // Parse Answer Key
  const answerMap = new Map();
  if (answerPart) {
    const answerLines = answerPart.split('\n');
    let currentAnsNum = null;
    let currentAnsChoice = 1;
    let currentExplanation = '';

    const saveCurrentAns = () => {
      if (currentAnsNum !== null) {
        answerMap.set(currentAnsNum, {
          answer: currentAnsChoice,
          explanation: currentExplanation.trim()
        });
      }
    };

    const choiceCharToNum = (char) => {
      const map = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
      return map[char] || 1;
    };

    for (const line of answerLines) {
      const match = line.match(/^\s*(\d+)\.\s*([①-⑤1-5])\s*[—\-–]\s*(.*)$/);
      if (match) {
        saveCurrentAns();
        currentAnsNum = parseInt(match[1], 10);
        currentAnsChoice = choiceCharToNum(match[2]);
        currentExplanation = match[3] || '';
      } else if (currentAnsNum !== null && line.trim()) {
        currentExplanation += ' ' + line.trim();
      }
    }
    saveCurrentAns();
  }

  // Parse Questions
  const lines = questionPart.split('\n');
  const questions = [];
  let currentQ = null;

  const saveCurrentQ = () => {
    if (currentQ && currentQ.options.length > 0) {
      const ansInfo = answerMap.get(currentQ.number) || { answer: null, explanation: '' };
      currentQ.correctAnswer = ansInfo.answer;
      currentQ.explanation = ansInfo.explanation;
      questions.push(currentQ);
    }
  };

  const optionRegex = /^\s*([①-⑤]|\(\d+\)|\d+\))\s*(.*)$/;

  for (const line of lines) {
    const qMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    const optMatch = line.match(optionRegex);

    if (qMatch && !optMatch) {
      saveCurrentQ();
      currentQ = {
        id: `q_${qMatch[1]}`,
        number: parseInt(qMatch[1], 10),
        question: qMatch[2].trim(),
        options: []
      };
    } else if (optMatch && currentQ) {
      currentQ.options.push(optMatch[2].trim());
    } else if (currentQ) {
      if (currentQ.options.length === 0) {
        currentQ.question += ' ' + line.trim();
      } else {
        currentQ.options[currentQ.options.length - 1] += ' ' + line.trim();
      }
    }
  }
  saveCurrentQ();

  return questions;
}

export function formatExamText(questions = []) {
  const options = ['①', '②', '③', '④', '⑤'];
  const body = questions.map((q, index) => `${index + 1}. ${q.question}\n${q.options.map((option, i) => `  ${options[i]} ${option}`).join('\n')}`).join('\n\n');
  const answers = questions.map((q, index) => `${index + 1}. ${options[q.correctAnswer - 1]} — ${q.explanation || ''}`).join('\n');
  return body ? `${body}\n\n${answers}` : '';
}



/**
 * 20~50개의 문제 풀에서 랜덤하게 count(기본 20개) 문제를 무작위 추출하여 셔플
 */
export function selectRandomQuestions(questionPool, count = 20) {
  const pool = Array.isArray(questionPool) && questionPool.length > 0 
    ? [...questionPool] 
    : [];

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Take up to count (default 20)
  const selected = pool.slice(0, Math.min(count, pool.length));

  // Re-number 1 to N for the exam instance
  return selected.map((q, idx) => ({
    ...q,
    examIndex: idx + 1
  }));
}

/**
 * 시험 채점 (총 20문제, 1문제당 5점, 60점 이상 합격)
 * userAnswers: { [questionId or examIndex]: chosenOptionNumber (1, 2, 3, 4) }
 */
export function evaluateExam(questions, userAnswers) {
  let correctCount = 0;
  const totalCount = questions.length;
  // 20문제 고정 출제 기준: 문항당 5점 (100점 만점)
  const pointPerQuestion = totalCount > 0 ? (100 / totalCount) : 5;

  const questionResults = questions.map((q, idx) => {
    const chosen = userAnswers[q.id] || userAnswers[q.examIndex] || null;
    const isCorrect = Number(chosen) === Number(q.correctAnswer);
    if (isCorrect) correctCount++;

    return {
      id: q.id,
      number: q.number,
      examIndex: q.examIndex || idx + 1,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      chosenAnswer: chosen,
      isCorrect,
      explanation: q.explanation || ''
    };
  });

  const score = Math.round(correctCount * pointPerQuestion);
  const passed = score >= 60; // 수료 기준 60점 (20문제 중 12문제 이상 정답)

  return {
    score,
    passed,
    correctCount,
    totalCount,
    pointPerQuestion,
    passScore: 60,
    questionResults,
    submittedAt: new Date().toISOString()
  };
}

import { remoteDb } from './apiClient.js';

/**
 * 코스별 문제 풀 반환 (커스텀 등록 문제가 있으면 우선, 없으면 기본 20문제)
 */
export function getCourseExamPool(courseId, coursesList = []) {
  const courses = Array.isArray(coursesList) ? coursesList : [];
  const course = courses.find(c => c.id === courseId);

  if (course && Array.isArray(course.examQuestions) && course.examQuestions.length > 0) {
    return course.examQuestions;
  }
  if (course && course.rawExamText) {
    const parsed = parseExamText(course.rawExamText);
    if (parsed.length > 0) return parsed;
  }

  return [];
}

export const getExamPool = getCourseExamPool;

/**
 * 시험 응시 결과 저장 (100% Supabase Direct)
 */
export async function saveExamAttempt(userId, courseId, attemptData) {
  const newAttempt = {
    id: `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    courseId,
    score: attemptData.score,
    passed: attemptData.passed,
    correctCount: attemptData.correctCount,
    totalCount: attemptData.totalCount,
    questionResults: attemptData.questionResults,
    createdAt: attemptData.submittedAt || new Date().toISOString()
  };

  // An attempt only exists after the database confirms persistence.
  await remoteDb.insertExamAttempt(newAttempt);

  return newAttempt;
}

/**
 * 사용자의 해당 코스 최신 응시 결과 조회 (attemptsList가 주어지면 메모리 조회, 아니면 remoteDb 비동기 조회)
 */
export function getLatestExamAttempt(userId, courseId, attemptsList = []) {
  if (!Array.isArray(attemptsList)) return null;
  const userAttempts = attemptsList
    .filter(a => a.userId === userId && a.courseId === courseId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  return userAttempts[0] || null;
}

/**
 * 사용자가 해당 코스의 시험에 60점 이상 합격했는지 확인
 */
export function hasPassedCourseExam(userId, courseId, attemptsList = []) {
  if (!userId || !courseId) return false;
  if (Array.isArray(attemptsList) && attemptsList.length > 0) {
    return attemptsList.some(a => a.userId === userId && a.courseId === courseId && a.passed === true);
  }
  return false;
}

export function isExamPassed(result) {
  return Boolean(result && result.passed);
}

