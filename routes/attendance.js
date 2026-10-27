const router = require('express').Router();
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const { protect } = require('../middleware/auth');

router.use(protect);

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

// GET /api/attendance?date=YYYY-MM-DD&className=Grade 8-A
router.get('/', async (req, res, next) => {
  try {
    const { date, className } = req.query;
    if (!isDate(date)) return res.status(400).json({ message: 'date (YYYY-MM-DD) is required' });
    const filter = { date };
    if (className) {
      const ids = await Student.find({ className, active: true }).distinct('_id');
      filter.student = { $in: ids };
    }
    res.json(await Attendance.find(filter));
  } catch (err) { next(err); }
});

// POST /api/attendance/bulk  { date, records: [{ student, status, note }] }
// Safe to call again for the same date: existing records are updated.
router.post('/bulk', async (req, res, next) => {
  try {
    const { date, records } = req.body;
    if (!isDate(date)) return res.status(400).json({ message: 'date (YYYY-MM-DD) is required' });
    if (!Array.isArray(records) || !records.length) return res.status(400).json({ message: 'records are required' });

    const ops = records.map((r) => ({
      updateOne: {
        filter: { student: r.student, date },
        update: { $set: { status: r.status, note: r.note || '', markedBy: req.user._id } },
        upsert: true,
      },
    }));
    const result = await Attendance.bulkWrite(ops);
    res.json({ message: 'Attendance saved', saved: records.length, created: result.upsertedCount, updated: result.modifiedCount });
  } catch (err) { next(err); }
});

// GET /api/attendance/student/:id?from=&to=   -> one student's history
router.get('/student/:id', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const filter = { student: req.params.id };
    if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    res.json(await Attendance.find(filter).sort({ date: -1 }));
  } catch (err) { next(err); }
});

module.exports = router;