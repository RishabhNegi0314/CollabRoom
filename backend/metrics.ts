class MetricsCollector {
  private firestoreReadTimes: number[] = [];
  private firestoreWriteTimes: number[] = [];
  private compilerExecutionTimes: number[] = [];

  public recordFirestoreRead(duration: number) {
    this.firestoreReadTimes.push(duration);
    if (this.firestoreReadTimes.length > 50) this.firestoreReadTimes.shift();
  }

  public recordFirestoreWrite(duration: number) {
    this.firestoreWriteTimes.push(duration);
    if (this.firestoreWriteTimes.length > 50) this.firestoreWriteTimes.shift();
  }

  public recordCompilerExecution(duration: number) {
    this.compilerExecutionTimes.push(duration);
    if (this.compilerExecutionTimes.length > 50) this.compilerExecutionTimes.shift();
  }

  private getAverage(arr: number[]): number {
    if (arr.length === 0) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  public getSummary() {
    return {
      avgFirestoreReadMs: this.getAverage(this.firestoreReadTimes),
      avgFirestoreWriteMs: this.getAverage(this.firestoreWriteTimes),
      avgCompilerExecutionMs: this.getAverage(this.compilerExecutionTimes),
    };
  }
}

export const metricsCollector = new MetricsCollector();
