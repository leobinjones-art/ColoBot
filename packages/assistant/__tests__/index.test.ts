/**
 * @colobot/assistant 测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, closeDb, createTodo, listTodos, createReminder, parseTime, parseIntent } from '../src/index.js';

describe('Assistant Package', () => {
  beforeEach(() => {
    getDb({ inMemory: true });
  });

  afterEach(() => {
    closeDb();
  });

  describe('Todo', () => {
    it('should create a todo', () => {
      const todo = createTodo({
        userId: 'user1',
        title: 'Test todo',
        description: 'Test description',
        priority: 'high',
      });

      expect(todo.id).toBeDefined();
      expect(todo.title).toBe('Test todo');
      expect(todo.priority).toBe('high');
      expect(todo.status).toBe('pending');
    });

    it('should list todos', () => {
      createTodo({ userId: 'user1', title: 'Todo 1' });
      createTodo({ userId: 'user1', title: 'Todo 2' });
      createTodo({ userId: 'user2', title: 'Todo 3' });

      const todos = listTodos('user1');
      expect(todos).toHaveLength(2);
    });

    it('should filter todos by status', () => {
      createTodo({ userId: 'user1', title: 'Todo 1' });
      const todo2 = createTodo({ userId: 'user1', title: 'Todo 2' });

      const db = getDb();
      db.prepare(`UPDATE assistant_todos SET status = 'done' WHERE id = ?`).run(todo2.id);

      const pendingTodos = listTodos('user1', { status: 'pending' });
      expect(pendingTodos).toHaveLength(1);
    });
  });

  describe('Reminder', () => {
    it('should create a reminder', () => {
      const reminder = createReminder({
        userId: 'user1',
        title: 'Test reminder',
        remindAt: new Date(Date.now() + 3600000),
      });

      expect(reminder.id).toBeDefined();
      expect(reminder.title).toBe('Test reminder');
      expect(reminder.status).toBe('pending');
    });

    it('should create a repeating reminder', () => {
      const reminder = createReminder({
        userId: 'user1',
        title: 'Daily standup',
        remindAt: new Date(),
        repeat: 'daily',
      });

      expect(reminder.repeat).toBe('daily');
    });
  });

  describe('Time Parser', () => {
    it('should parse relative time', () => {
      const now = new Date();
      const result = parseTime('明天下午3点', now);
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThan(0.5);
    });

    it('should parse absolute time', () => {
      const result = parseTime('2024-12-25 10:00');
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(1);
    });

    it('should parse "X hours later"', () => {
      const now = new Date();
      const result = parseTime('2小时后', now);
      expect(result).not.toBeNull();
      const expectedHour = (now.getHours() + 2) % 24;
      expect(result!.time.getHours()).toBe(expectedHour);
    });
  });

  describe('Intent Parser', () => {
    it('should recognize todo.add intent', () => {
      const intent = parseIntent('添加待办 完成报告');
      expect(intent.type).toBe('todo.add');
    });

    it('should recognize reminder.add intent', () => {
      const intent = parseIntent('提醒我明天下午3点开会');
      expect(intent.type).toBe('reminder.add');
    });

    it('should recognize todo.list intent', () => {
      const intent = parseIntent('列出我的待办');
      expect(intent.type).toBe('todo.list');
    });

    it('should return unknown for unrecognized text', () => {
      const intent = parseIntent('随便说点什么');
      expect(intent.type).toBe('unknown');
    });
  });
});
