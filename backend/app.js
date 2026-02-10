import app from '#root/app_initial.js';

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(`\nCODYMATCH BACKEND READY ON PORT ${PORT}`);
});
