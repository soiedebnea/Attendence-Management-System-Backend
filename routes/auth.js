const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

const sign = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

// First account ever created becomes admin (open signup). After that, only an admin can add users.
router.post('/register', async (req, res, next) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) {
      // fall through to protected flow
      return protect(req, res, () =>
        adminOnly(req, res, async () => {
          const user = await User.create({ ...req.body, role: req.body.role || 'teacher' });
          res.status(201).json(publicUser(user));
        })
      );
    }
    const user = await User.create({ ...req.body, role: 'admin' });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password || ''))) {
      return res.status(401).json({ message: 'Email or password is incorrect' });
    }
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.get('/me', protect, (req, res) => res.json(publicUser(req.user)));

// Lets the login screen know whether to show "Create admin account"
router.get('/setup-status', async (req, res) => {
  res.json({ needsSetup: (await User.countDocuments()) === 0 });
});

module.exports = router;