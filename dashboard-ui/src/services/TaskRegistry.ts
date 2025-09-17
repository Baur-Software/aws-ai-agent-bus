// TaskRegistry for workflow tasks and services
export class TaskRegistry {
  private tasks = new Map<string, any>();
  private services = new Map<string, any>();

  registerTask<T>(type: string, task: T): void {
    this.tasks.set(type, task);
  }

  registerService<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  getTask(type: string): any {
    return this.tasks.get(type);
  }

  getService<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not registered`);
    }
    return service as T;
  }

  getAllTaskTypes(): string[] {
    return Array.from(this.tasks.keys());
  }
}
