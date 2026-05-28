module.exports = async function (context, req) {
  const { name, email } = req.body || {};
  context.log(`Member approved: ${name} (${email})`);
  // Ready for SendGrid / email integration — see README for setup notes
  context.res = { status: 200, body: { ok: true } };
};
