const TEACHER_ROLES = new Set(['teacher', 'admin']);

const getRequestUser = (req) => req.session?.user || req.user || null;

const getRequestRole = (req) => getRequestUser(req)?.role || null;

const getRequestUserId = (req) => {
  const userId = Number(getRequestUser(req)?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

const isPrivilegedRole = (role) => TEACHER_ROLES.has(role);

const isPrivilegedUser = (req) => isPrivilegedRole(getRequestRole(req));

const sendAuthRequired = (res) =>
  res.status(401).json({
    success: false,
    error: 'Authentication required.',
  });

const sendForbidden = (res) =>
  res.status(403).json({
    success: false,
    error: 'Not authorized.',
  });

const requireAuthenticatedUser = (req, res, next) => {
  if (!getRequestUserId(req)) {
    return sendAuthRequired(res);
  }
  return next();
};

const requirePrivilegedUser = (req, res, next) => {
  if (!getRequestUserId(req)) {
    return sendAuthRequired(res);
  }
  if (!isPrivilegedUser(req)) {
    return sendForbidden(res);
  }
  return next();
};

const parseBooleanQuery = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

export {
  getRequestRole,
  getRequestUser,
  getRequestUserId,
  isPrivilegedRole,
  isPrivilegedUser,
  parseBooleanQuery,
  requireAuthenticatedUser,
  requirePrivilegedUser,
  sendAuthRequired,
  sendForbidden,
};
