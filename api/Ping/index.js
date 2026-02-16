module.exports = async function (context, req) {
    context.res = { status: 200, body: { status: "ok", timestamp: new Date().toISOString() } };
};
