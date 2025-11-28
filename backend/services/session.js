export async function getUserInfo(req, id, refresh = false /*, transaction*/) {
  // check if the user data is not already in the session or if refresh is true
  if (
    refresh ||
    !(req.session.user && req.session.permissions && req.session.roles)
  ) {
    req.session.user = {
      id,
      username: 'admin',
      displayName: 'Administrator',
      email: 'email@email.com',
    };
  }
  return {
    user: req.session.user,
  };
}
