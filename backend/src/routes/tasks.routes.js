const express = require('express');
const tasksService = require('../services/tasks.service');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
    }
  };
}

router.get(
  '/stats/summary',
  handle(async (req, res) => {
    const stats = tasksService.getStats(req.user.id);
    res.json({ stats });
  })
);

router.get(
  '/',
  handle(async (req, res) => {
    const tasks = tasksService.listTasks(req.user.id, {
      stage: req.query.stage,
      search: req.query.search
    });
    res.json({ tasks });
  })
);

router.get(
  '/:id',
  handle(async (req, res) => {
    const task = tasksService.getTask(req.user.id, req.params.id);
    res.json({ task });
  })
);

router.post(
  '/',
  handle(async (req, res) => {
    const task = tasksService.createTask(req.user.id, req.body);
    res.status(201).json({ task });
  })
);

router.put(
  '/:id',
  handle(async (req, res) => {
    const task = tasksService.updateTask(req.user.id, req.params.id, req.body);
    res.json({ task });
  })
);

router.patch(
  '/:id/stage',
  handle(async (req, res) => {
    const { stage } = req.body;
    if (!stage) {
      return res.status(400).json({ error: 'Stage is required.' });
    }
    const task = tasksService.updateTaskStage(req.user.id, req.params.id, stage);
    res.json({ task });
  })
);

router.delete(
  '/:id',
  handle(async (req, res) => {
    tasksService.deleteTask(req.user.id, req.params.id);
    res.json({ message: 'Task deleted.' });
  })
);

module.exports = router;
