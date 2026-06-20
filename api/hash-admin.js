const bcrypt = require('bcryptjs');

async function hashPassword() {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('HKM#146', salt);
    console.log(`ADMIN_EMAIL=mukunda@hkmvizag.org`);
    console.log(`ADMIN_PASSWORD_HASH=${hash}`);
    return hash;
}

hashPassword();
