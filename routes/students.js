const router = require('express').Router();
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);

// GET /api/students?className=&search=
router.get('/', async (req, res, next) => {
  try {
    const { className, search } = req.query;
    const filter = { active: true };
    if (className) filter.className = className;
    if (search) filter.name = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    res.json(await Student.find(filter).sort({ className: 1, rollNo: 1 }));
  } catch (err) { next(err); }
});

router.get('/classes', async (req, res, next) => {
  try {
    res.json((await Student.distinct('className', { active: true })).sort());
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await Student.create(req.body)); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const s = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!s) return res.status(404).json({ message: 'Student not found' });
    res.json(s);
  } catch (err) { next(err); }
});

// Deleting a student also removes their attendance history
router.delete('/:id', adminOnly, async (req, res, next) => {
  try {
    const s = await Student.findByIdAndDelete(req.params.id);
    if (!s) return res.status(404).json({ message: 'Student not found' });
    await Attendance.deleteMany({ student: s._id });
    res.json({ message: 'Student deleted' });
  } catch (err) { next(err); }
});

module.exports = router;