const { v4: uuid } = require('uuid');
const db = require('../db/database');
const { stages } = require('../config');

function mapTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    stage: row.stage,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateStage(stage) {
  return stages.includes(stage);
}

function listTasks(userId, { stage, search } = {}) {
  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [userId];

  if (stage) {
    sql += ' AND stage = ?';
    params.push(stage);
  }

  if (search) {
    sql += ' AND (title LIKE ? OR description LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }

  sql += ' ORDER BY updated_at DESC';
  return db.prepare(sql).all(...params).map(mapTask);
}

function getTask(userId, taskId) {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, userId);
  if (!row) {
    const err = new Error('Task not found.');
    err.status = 404;
    throw err;
  }
  return mapTask(row);
}

function createTask(userId, { title, description, stage, priority }) {
  const trimmedTitle = String(title || '').trim();
  const trimmedStage = String(stage || '').trim();

  if (!trimmedTitle || !validateStage(trimmedStage)) {
    const err = new Error('Task title and valid stage are required.');
    err.status = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const task = {
    id: uuid(),
    user_id: userId,
    title: trimmedTitle,
    description: String(description || '').trim(),
    stage: trimmedStage,
    priority: Number(priority) || 0,
    created_at: now,
    updated_at: now
  };

  db.prepare(
    `INSERT INTO tasks (id, user_id, title, description, stage, priority, created_at, updated_at)
     VALUES (@id, @user_id, @title, @description, @stage, @priority, @created_at, @updated_at)`
  ).run(task);

  return mapTask(task);
}

function updateTask(userId, taskId, updates) {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, userId);
  if (!existing) {
    const err = new Error('Task not found.');
    err.status = 404;
    throw err;
  }

  const title = updates.title !== undefined ? String(updates.title).trim() : existing.title;
  const description =
    updates.description !== undefined ? String(updates.description).trim() : existing.description;
  const stage = updates.stage !== undefined ? String(updates.stage).trim() : existing.stage;
  const priority = updates.priority !== undefined ? Number(updates.priority) : existing.priority;

  if (!title || !validateStage(stage)) {
    const err = new Error('Task title and valid stage are required.');
    err.status = 400;
    throw err;
  }

  const updated_at = new Date().toISOString();
  db.prepare(
    `UPDATE tasks SET title = ?, description = ?, stage = ?, priority = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(title, description, stage, priority, updated_at, taskId, userId);

  return getTask(userId, taskId);
}

function updateTaskStage(userId, taskId, stage) {
  return updateTask(userId, taskId, { stage });
}

function deleteTask(userId, taskId) {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(taskId, userId);
  if (result.changes === 0) {
    const err = new Error('Task not found.');
    err.status = 404;
    throw err;
  }
}

function getStats(userId) {
  const rows = db
    .prepare(
      `SELECT stage, COUNT(*) as count FROM tasks WHERE user_id = ?
       GROUP BY stage`
    )
    .all(userId);

  const byStage = { Todo: 0, 'In Progress': 0, Done: 0 };
  rows.forEach((r) => {
    byStage[r.stage] = r.count;
  });

  const total = Object.values(byStage).reduce((a, b) => a + b, 0);
  return { total, byStage };
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStage,
  deleteTask,
  getStats,
  validateStage
};
