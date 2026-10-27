const router = require('express').Router();
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const { protect } = require('../middleware/auth');

router.use(protect);

const dateRange = ({ from, to }) =>
  from || to ? { date: { ...(from && { $gte: from }), ...(to && { $lte: to }) } } : {};

// Per-student totals and attendance percentage (late counts as attended)
async function buildSummary(query) {
  const rows = await Attendance.aggregate([
    { $match: dateRange(query) },
    {
      $group: {
        _id: '$student',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        excused: { $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] } },
      },
    },
    { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    ...(query.className ? [{ $match: { 'student.className': query.className } }] : []),
    {
      $project: {
        _id: 0,
        studentId: '$student._id',
        name: '$student.name',
        rollNo: '$student.rollNo',
        className: '$student.className',
        total: 1, present: 1, absent: 1, late: 1, excused: 1,
        percentage: {
          $round: [{ $multiply: [{ $divide: [{ $add: ['$present', '$late'] }, '$total'] }, 100] }, 1],
        },
      },
    },
    { $sort: { className: 1, rollNo: 1 } },
  ]);
  return rows;
}

// GET /api/reports/summary?from=&to=&className=
router.get('/summary', async (req, res, next) => {
  try { res.json(await buildSummary(req.query)); } catch (err) { next(err); }
});

// GET /api/reports/absences?from=&to=&className=   -> every absence, newest first
router.get('/absences', async (req, res, next) => {
  try {
    const filter = { status: 'absent', ...dateRange(req.query) };
    if (req.query.className) {
      filter.student = { $in: await Student.find({ className: req.query.className }).distinct('_id') };
    }
    const rows = await Attendance.find(filter).populate('student', 'name rollNo className guardianPhone').sort({ date: -1 });
    res.json(rows.filter((r) => r.student));
  } catch (err) { next(err); }
});

// GET /api/reports/daily?date=YYYY-MM-DD   -> dashboard numbers
router.get('/daily', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const [totalStudents, records] = await Promise.all([
      Student.countDocuments({ active: true }),
      Attendance.find({ date }).populate('student', 'name rollNo className guardianPhone'),
    ]);
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    records.forEach((r) => { counts[r.status] += 1; });
    res.json({
      date,
      totalStudents,
      marked: records.length,
      notMarked: Math.max(totalStudents - records.length, 0),
      ...counts,
      absentees: records.filter((r) => r.status === 'absent' && r.student).map((r) => r.student),
    });
  } catch (err) { next(err); }
});

// GET /api/reports/export.csv?from=&to=&className=
router.get('/export.csv', async (req, res, next) => {
  try {
    const rows = await buildSummary(req.query);
    const header = ['Roll No', 'Name', 'Class', 'Days', 'Present', 'Absent', 'Late', 'Excused', 'Attendance %'];
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows.map((r) => [r.rollNo, r.name, r.className, r.total, r.present, r.absent, r.late, r.excused, r.percentage])]
      .map((line) => line.map(esc).join(','))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;