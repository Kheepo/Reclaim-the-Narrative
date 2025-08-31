/**
 * Enhanced state management utilities for preventing double submissions and managing loading states
 */

import { createEnhancedError, ErrorCategory } from './error-handling';

export interface SubmissionState {
  isSubmitting: boolean;
  submissionId: string | null;
  startTime: number | null;
  lastActivity: number;
  stage: string;
  progress: number;
  canRetry: boolean;
  retryCount: number;
  maxRetries: number;
}

export interface SessionState {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  isActive: boolean;
  timeoutWarningShown: boolean;
  autoSaveEnabled: boolean;
  lastAutoSave: number;
}

export interface FormState {
  isDirty: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: number | null;
  validationErrors: Record<string, string[]>;
  isValid: boolean;
  touchedFields: Set<string>;
}

// Global state managers
const submissionStates = new Map<string, SubmissionState>();
const sessionStates = new Map<string, SessionState>();
const formStates = new Map<string, FormState>();

// Constants
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SESSION_WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout
const AUTO_SAVE_INTERVAL = 30 * 1000; // 30 seconds
const MAX_SUBMISSION_TIME = 10 * 60 * 1000; // 10 minutes
const SUBMISSION_COOLDOWN = 5 * 1000; // 5 seconds between submissions

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Submission State Management
 */
export class SubmissionManager {
  private componentId: string;
  private listeners: Set<(state: SubmissionState) => void> = new Set();
  private cooldownTimer: NodeJS.Timeout | null = null;

  constructor(componentId: string) {
    this.componentId = componentId;
    this.initializeState();
  }

  private initializeState(): void {
    if (!submissionStates.has(this.componentId)) {
      submissionStates.set(this.componentId, {
        isSubmitting: false,
        submissionId: null,
        startTime: null,
        lastActivity: Date.now(),
        stage: 'idle',
        progress: 0,
        canRetry: true,
        retryCount: 0,
        maxRetries: 3
      });
    }
  }

  /**
   * Start submission process
   */
  startSubmission(): string {
    const state = submissionStates.get(this.componentId)!;
    
    // Check if already submitting
    if (state.isSubmitting) {
      throw createEnhancedError(
        'Submission already in progress. Please wait for the current submission to complete.',
        ErrorCategory.SYSTEM,
        { operation: 'double_submission_prevention', additionalData: { componentId: this.componentId } }
      );
    }
    
    // Check cooldown period
    const timeSinceLastSubmission = Date.now() - state.lastActivity;
    if (timeSinceLastSubmission < SUBMISSION_COOLDOWN && state.stage !== 'idle') {
      throw createEnhancedError(
        `Please wait ${Math.ceil((SUBMISSION_COOLDOWN - timeSinceLastSubmission) / 1000)} seconds before submitting again.`,
        ErrorCategory.SYSTEM,
        { operation: 'submission_cooldown', additionalData: { remainingTime: SUBMISSION_COOLDOWN - timeSinceLastSubmission } }
      );
    }
    
    const submissionId = generateId();
    const now = Date.now();
    
    const newState: SubmissionState = {
      ...state,
      isSubmitting: true,
      submissionId,
      startTime: now,
      lastActivity: now,
      stage: 'starting',
      progress: 0,
      canRetry: true
    };
    
    submissionStates.set(this.componentId, newState);
    this.notifyListeners(newState);
    
    // Set timeout for submission
    setTimeout(() => {
      this.checkSubmissionTimeout(submissionId);
    }, MAX_SUBMISSION_TIME);
    
    return submissionId;
  }

  /**
   * Update submission progress
   */
  updateProgress(submissionId: string, stage: string, progress: number): void {
    const state = submissionStates.get(this.componentId);
    if (!state || state.submissionId !== submissionId) {
      return; // Ignore updates for old submissions
    }
    
    const newState: SubmissionState = {
      ...state,
      stage,
      progress: Math.max(0, Math.min(100, progress)),
      lastActivity: Date.now()
    };
    
    submissionStates.set(this.componentId, newState);
    this.notifyListeners(newState);
  }

  /**
   * Complete submission
   */
  completeSubmission(submissionId: string): void {
    const state = submissionStates.get(this.componentId);
    if (!state || state.submissionId !== submissionId) {
      return;
    }
    
    const newState: SubmissionState = {
      ...state,
      isSubmitting: false,
      submissionId: null,
      startTime: null,
      stage: 'completed',
      progress: 100,
      lastActivity: Date.now(),
      retryCount: 0
    };
    
    submissionStates.set(this.componentId, newState);
    this.notifyListeners(newState);
    
    // Start cooldown
    this.startCooldown();
  }

  /**
   * Fail submission
   */
  failSubmission(submissionId: string, error: Error, canRetry = true): void {
    const state = submissionStates.get(this.componentId);
    if (!state || state.submissionId !== submissionId) {
      return;
    }
    
    const newRetryCount = state.retryCount + 1;
    const canRetryAgain = canRetry && newRetryCount < state.maxRetries;
    
    const newState: SubmissionState = {
      ...state,
      isSubmitting: false,
      submissionId: null,
      startTime: null,
      stage: 'failed',
      progress: 0,
      lastActivity: Date.now(),
      canRetry: canRetryAgain,
      retryCount: newRetryCount
    };
    
    submissionStates.set(this.componentId, newState);
    this.notifyListeners(newState);
  }

  /**
   * Reset submission state
   */
  resetSubmission(): void {
    const newState: SubmissionState = {
      isSubmitting: false,
      submissionId: null,
      startTime: null,
      lastActivity: Date.now(),
      stage: 'idle',
      progress: 0,
      canRetry: true,
      retryCount: 0,
      maxRetries: 3
    };
    
    submissionStates.set(this.componentId, newState);
    this.notifyListeners(newState);
  }

  /**
   * Get current state
   */
  getState(): SubmissionState {
    return submissionStates.get(this.componentId)!;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: SubmissionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(state: SubmissionState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in submission state listener:', error);
      }
    });
  }

  private checkSubmissionTimeout(submissionId: string): void {
    const state = submissionStates.get(this.componentId);
    if (state && state.submissionId === submissionId && state.isSubmitting) {
      this.failSubmission(
        submissionId,
        new Error('Submission timed out'),
        true
      );
    }
  }

  private startCooldown(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }
    
    this.cooldownTimer = setTimeout(() => {
      const state = submissionStates.get(this.componentId);
      if (state && state.stage === 'completed') {
        const newState = { ...state, stage: 'idle' };
        submissionStates.set(this.componentId, newState);
        this.notifyListeners(newState);
      }
    }, SUBMISSION_COOLDOWN);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }
    submissionStates.delete(this.componentId);
    this.listeners.clear();
  }
}

/**
 * Session Management
 */
export class SessionManager {
  private componentId: string;
  private listeners: Set<(state: SessionState) => void> = new Set();
  private timeoutTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;

  constructor(componentId: string) {
    this.componentId = componentId;
    this.initializeSession();
    this.startSessionMonitoring();
  }

  private initializeSession(): void {
    const sessionId = generateId();
    const now = Date.now();
    
    const sessionState: SessionState = {
      sessionId,
      startTime: now,
      lastActivity: now,
      isActive: true,
      timeoutWarningShown: false,
      autoSaveEnabled: true,
      lastAutoSave: now
    };
    
    sessionStates.set(this.componentId, sessionState);
    this.notifyListeners(sessionState);
  }

  /**
   * Update activity timestamp
   */
  updateActivity(): void {
    const state = sessionStates.get(this.componentId);
    if (!state || !state.isActive) return;
    
    const newState: SessionState = {
      ...state,
      lastActivity: Date.now(),
      timeoutWarningShown: false
    };
    
    sessionStates.set(this.componentId, newState);
    this.notifyListeners(newState);
    
    // Reset timers
    this.resetSessionTimers();
  }

  /**
   * Get session state
   */
  getState(): SessionState {
    return sessionStates.get(this.componentId)!;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    const state = sessionStates.get(this.componentId);
    return state ? state.isActive : false;
  }

  /**
   * Extend session
   */
  extendSession(): void {
    this.updateActivity();
  }

  /**
   * End session
   */
  endSession(): void {
    const state = sessionStates.get(this.componentId);
    if (!state) return;
    
    const newState: SessionState = {
      ...state,
      isActive: false,
      lastActivity: Date.now()
    };
    
    sessionStates.set(this.componentId, newState);
    this.notifyListeners(newState);
    
    this.clearTimers();
  }

  /**
   * Subscribe to session changes
   */
  subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private startSessionMonitoring(): void {
    this.resetSessionTimers();
    
    // Auto-save timer
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(() => {
      const state = sessionStates.get(this.componentId);
      if (state && state.isActive && state.autoSaveEnabled) {
        this.triggerAutoSave();
      }
    }, AUTO_SAVE_INTERVAL);
  }

  private resetSessionTimers(): void {
    // Clear existing timers
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    
    // Set warning timer
    this.warningTimer = setTimeout(() => {
      this.showTimeoutWarning();
    }, SESSION_TIMEOUT - SESSION_WARNING_TIME);
    
    // Set timeout timer
    this.timeoutTimer = setTimeout(() => {
      this.handleSessionTimeout();
    }, SESSION_TIMEOUT);
  }

  private showTimeoutWarning(): void {
    const state = sessionStates.get(this.componentId);
    if (!state || !state.isActive) return;
    
    const newState: SessionState = {
      ...state,
      timeoutWarningShown: true
    };
    
    sessionStates.set(this.componentId, newState);
    this.notifyListeners(newState);
  }

  private handleSessionTimeout(): void {
    this.endSession();
  }

  private triggerAutoSave(): void {
    const state = sessionStates.get(this.componentId);
    if (!state) return;
    
    const newState: SessionState = {
      ...state,
      lastAutoSave: Date.now()
    };
    
    sessionStates.set(this.componentId, newState);
    
    // Emit auto-save event (only in browser environment)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('autoSave', {
        detail: { componentId: this.componentId }
      }));
    }
  }

  private notifyListeners(state: SessionState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in session state listener:', error);
      }
    });
  }

  private clearTimers(): void {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clearTimers();
    sessionStates.delete(this.componentId);
    this.listeners.clear();
  }
}

/**
 * Form State Management
 */
export class FormStateManager {
  private componentId: string;
  private listeners: Set<(state: FormState) => void> = new Set();
  private validationDebounceTimer: NodeJS.Timeout | null = null;

  constructor(componentId: string) {
    this.componentId = componentId;
    this.initializeFormState();
  }

  private initializeFormState(): void {
    const formState: FormState = {
      isDirty: false,
      hasUnsavedChanges: false,
      lastSaved: null,
      validationErrors: {},
      isValid: true,
      touchedFields: new Set()
    };
    
    formStates.set(this.componentId, formState);
    this.notifyListeners(formState);
  }

  /**
   * Mark field as touched
   */
  touchField(fieldName: string): void {
    const state = formStates.get(this.componentId)!;
    const newTouchedFields = new Set(state.touchedFields);
    newTouchedFields.add(fieldName);
    
    const newState: FormState = {
      ...state,
      touchedFields: newTouchedFields,
      isDirty: true,
      hasUnsavedChanges: true
    };
    
    formStates.set(this.componentId, newState);
    this.notifyListeners(newState);
  }

  /**
   * Set validation errors
   */
  setValidationErrors(errors: Record<string, string[]>): void {
    const state = formStates.get(this.componentId)!;
    const isValid = Object.keys(errors).length === 0;
    
    const newState: FormState = {
      ...state,
      validationErrors: errors,
      isValid
    };
    
    formStates.set(this.componentId, newState);
    this.notifyListeners(newState);
  }

  /**
   * Add validation error for field
   */
  addValidationError(fieldName: string, error: string): void {
    const state = formStates.get(this.componentId)!;
    const newErrors = { ...state.validationErrors };
    
    if (!newErrors[fieldName]) {
      newErrors[fieldName] = [];
    }
    
    if (!newErrors[fieldName].includes(error)) {
      newErrors[fieldName].push(error);
    }
    
    this.setValidationErrors(newErrors);
  }

  /**
   * Clear validation errors for field
   */
  clearValidationErrors(fieldName: string): void {
    const state = formStates.get(this.componentId)!;
    const newErrors = { ...state.validationErrors };
    delete newErrors[fieldName];
    
    this.setValidationErrors(newErrors);
  }

  /**
   * Mark form as saved
   */
  markAsSaved(): void {
    const state = formStates.get(this.componentId)!;
    
    const newState: FormState = {
      ...state,
      hasUnsavedChanges: false,
      lastSaved: Date.now()
    };
    
    formStates.set(this.componentId, newState);
    this.notifyListeners(newState);
  }

  /**
   * Reset form state
   */
  reset(): void {
    this.initializeFormState();
  }

  /**
   * Get form state
   */
  getState(): FormState {
    return formStates.get(this.componentId)!;
  }

  /**
   * Check if form has unsaved changes
   */
  hasUnsavedChanges(): boolean {
    const state = formStates.get(this.componentId);
    return state ? state.hasUnsavedChanges : false;
  }

  /**
   * Subscribe to form state changes
   */
  subscribe(listener: (state: FormState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(state: FormState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in form state listener:', error);
      }
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.validationDebounceTimer) {
      clearTimeout(this.validationDebounceTimer);
    }
    formStates.delete(this.componentId);
    this.listeners.clear();
  }
}

/**
 * Global state cleanup
 */
export function cleanupGlobalState(): void {
  submissionStates.clear();
  sessionStates.clear();
  formStates.clear();
}

/**
 * Get all active submissions
 */
export function getActiveSubmissions(): string[] {
  const active: string[] = [];
  submissionStates.forEach((state, componentId) => {
    if (state.isSubmitting) {
      active.push(componentId);
    }
  });
  return active;
}

/**
 * Check if any submissions are active
 */
export function hasActiveSubmissions(): boolean {
  return getActiveSubmissions().length > 0;
}

/**
 * Prevent page unload if there are unsaved changes or active submissions
 */
export function setupUnloadProtection(): () => void {
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    const hasUnsaved = Array.from(formStates.values()).some(state => state.hasUnsavedChanges);
    const hasActive = hasActiveSubmissions();
    
    if (hasUnsaved || hasActive) {
      event.preventDefault();
      event.returnValue = 'You have unsaved changes or active submissions. Are you sure you want to leave?';
      return event.returnValue;
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}