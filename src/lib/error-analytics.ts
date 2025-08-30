import { ErrorCategory, ErrorSeverity } from './error-handler';

// Error Analytics and Monitoring System
export interface ErrorMetrics {
  timestamp: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId: string;
  errorId: string;
  context?: Record<string, any>;
  resolved?: boolean;
  resolutionTime?: number;
}

export interface PerformanceMetrics {
  timestamp: number;
  operation: string;
  duration: number;
  success: boolean;
  errorCount: number;
  memoryUsage?: number;
  networkLatency?: number;
}

export interface SystemHealth {
  errorRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  activeUsers: number;
  systemLoad: number;
  uptime: number;
}

export class ErrorAnalytics {
  private static instance: ErrorAnalytics;
  private errorBuffer: ErrorMetrics[] = [];
  private performanceBuffer: PerformanceMetrics[] = [];
  private sessionId: string;
  private maxBufferSize = 1000;
  private flushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.startPerformanceMonitoring();
    this.setupFlushTimer();
  }

  static getInstance(): ErrorAnalytics {
    if (!ErrorAnalytics.instance) {
      ErrorAnalytics.instance = new ErrorAnalytics();
    }
    return ErrorAnalytics.instance;
  }

  // Track error occurrence
  trackError(error: Error, category: ErrorCategory, severity: ErrorSeverity, context?: Record<string, any>): void {
    const errorMetric: ErrorMetrics = {
      timestamp: Date.now(),
      category,
      severity,
      message: error.message,
      stack: error.stack,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      sessionId: this.sessionId,
      errorId: this.generateErrorId(),
      context,
      resolved: false
    };

    this.errorBuffer.push(errorMetric);
    this.checkBufferSize();

    // Log critical errors immediately
    if (severity === ErrorSeverity.CRITICAL) {
      this.flushErrors();
    }
  }

  // Track performance metrics
  trackPerformance(operation: string, duration: number, success: boolean, errorCount = 0): void {
    const performanceMetric: PerformanceMetrics = {
      timestamp: Date.now(),
      operation,
      duration,
      success,
      errorCount,
      memoryUsage: this.getMemoryUsage(),
      networkLatency: this.getNetworkLatency()
    };

    this.performanceBuffer.push(performanceMetric);
    this.checkBufferSize();
  }

  // Mark error as resolved
  resolveError(errorId: string): void {
    const error = this.errorBuffer.find(e => e.errorId === errorId);
    if (error && !error.resolved) {
      error.resolved = true;
      error.resolutionTime = Date.now() - error.timestamp;
    }
  }

  // Get error statistics
  getErrorStats(timeWindow = 3600000): { // 1 hour default
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    resolved: number;
    averageResolutionTime: number;
  } {
    const cutoff = Date.now() - timeWindow;
    const recentErrors = this.errorBuffer.filter(e => e.timestamp > cutoff);

    const byCategory = {} as Record<ErrorCategory, number>;
    const bySeverity = {} as Record<ErrorSeverity, number>;
    let resolvedCount = 0;
    let totalResolutionTime = 0;
    let resolvedWithTime = 0;

    recentErrors.forEach(error => {
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      
      if (error.resolved) {
        resolvedCount++;
        if (error.resolutionTime) {
          totalResolutionTime += error.resolutionTime;
          resolvedWithTime++;
        }
      }
    });

    return {
      total: recentErrors.length,
      byCategory,
      bySeverity,
      resolved: resolvedCount,
      averageResolutionTime: resolvedWithTime > 0 ? totalResolutionTime / resolvedWithTime : 0
    };
  }

  // Get performance statistics
  getPerformanceStats(timeWindow = 3600000): {
    averageResponseTime: number;
    successRate: number;
    totalOperations: number;
    slowestOperations: PerformanceMetrics[];
  } {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.performanceBuffer.filter(m => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        successRate: 0,
        totalOperations: 0,
        slowestOperations: []
      };
    }

    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const successCount = recentMetrics.filter(m => m.success).length;
    const slowestOperations = recentMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      averageResponseTime: totalDuration / recentMetrics.length,
      successRate: successCount / recentMetrics.length,
      totalOperations: recentMetrics.length,
      slowestOperations
    };
  }

  // Get system health overview
  getSystemHealth(): SystemHealth {
    const errorStats = this.getErrorStats();
    const performanceStats = this.getPerformanceStats();

    return {
      errorRate: errorStats.total / Math.max(performanceStats.totalOperations, 1),
      averageResponseTime: performanceStats.averageResponseTime,
      memoryUsage: this.getMemoryUsage(),
      activeUsers: this.getActiveUserCount(),
      systemLoad: this.getSystemLoad(),
      uptime: this.getUptime()
    };
  }

  // Export analytics data
  exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      errors: this.errorBuffer,
      performance: this.performanceBuffer,
      stats: {
        errors: this.getErrorStats(),
        performance: this.getPerformanceStats(),
        health: this.getSystemHealth()
      },
      exportTimestamp: Date.now(),
      sessionId: this.sessionId
    };

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  // Clear analytics data
  clearData(): void {
    this.errorBuffer = [];
    this.performanceBuffer = [];
  }

  // Private helper methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private checkBufferSize(): void {
    if (this.errorBuffer.length > this.maxBufferSize) {
      this.errorBuffer = this.errorBuffer.slice(-this.maxBufferSize * 0.8);
    }
    if (this.performanceBuffer.length > this.maxBufferSize) {
      this.performanceBuffer = this.performanceBuffer.slice(-this.maxBufferSize * 0.8);
    }
  }

  private setupFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushErrors();
      this.flushPerformance();
    }, this.flushInterval);
  }

  private flushErrors(): void {
    if (this.errorBuffer.length === 0) return;

    // In a real implementation, this would send data to analytics service
    console.log(`[Analytics] Flushing ${this.errorBuffer.length} error metrics`);
    
    // Keep only recent errors in buffer
    const cutoff = Date.now() - 86400000; // 24 hours
    this.errorBuffer = this.errorBuffer.filter(e => e.timestamp > cutoff);
  }

  private flushPerformance(): void {
    if (this.performanceBuffer.length === 0) return;

    console.log(`[Analytics] Flushing ${this.performanceBuffer.length} performance metrics`);
    
    // Keep only recent performance data
    const cutoff = Date.now() - 86400000; // 24 hours
    this.performanceBuffer = this.performanceBuffer.filter(p => p.timestamp > cutoff);
  }

  private startPerformanceMonitoring(): void {
    // Monitor page load performance
    if (typeof window !== 'undefined' && window.performance) {
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.trackPerformance(
            'page_load',
            navigation.loadEventEnd - navigation.fetchStart,
            true
          );
        }
      });
    }
  }

  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / memory.totalJSHeapSize;
    }
    return 0;
  }

  private getNetworkLatency(): number {
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return navigation ? navigation.responseStart - navigation.requestStart : 0;
    }
    return 0;
  }

  private getActiveUserCount(): number {
    // In a real implementation, this would track active sessions
    return 1;
  }

  private getSystemLoad(): number {
    // In a real implementation, this would get actual system metrics
    return Math.random() * 0.8; // Mock value
  }

  private getUptime(): number {
    return Date.now() - parseInt(this.sessionId.split('_')[1]);
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion for errors
    const headers = ['timestamp', 'category', 'severity', 'message', 'resolved'];
    const rows = data.errors.map((error: ErrorMetrics) => [
      new Date(error.timestamp).toISOString(),
      error.category,
      error.severity,
      error.message.replace(/,/g, ';'),
      error.resolved
    ]);

    return [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n');
  }

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.clearData();
  }
}

// Global analytics instance
export const globalErrorAnalytics = ErrorAnalytics.getInstance();

// Utility functions for easy access
export const trackError = (error: Error, category: ErrorCategory, severity: ErrorSeverity, context?: Record<string, any>) => {
  globalErrorAnalytics.trackError(error, category, severity, context);
};

export const trackPerformance = (operation: string, duration: number, success: boolean, errorCount = 0) => {
  globalErrorAnalytics.trackPerformance(operation, duration, success, errorCount);
};

export const getSystemHealth = () => globalErrorAnalytics.getSystemHealth();

export const exportAnalytics = (format: 'json' | 'csv' = 'json') => globalErrorAnalytics.exportData(format);