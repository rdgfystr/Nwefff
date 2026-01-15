'use strict';

/**
 * Optimized Error Handler for FCA
 * Shows only ONE clear, actionable error message
 */

const chalk = require('chalk');

function handleLoginError(error, callback) {
    // Determine the specific error type and show only ONE clear message
    let errorMessage = null;
    let errorType = 'unknown';
    let errorString = error ? error.toString() : '';
    
    // Check error object properties
    const errorObj = error && typeof error === 'object' ? error : {};
    const fullError = errorString + JSON.stringify(errorObj);
    
    // Priority 1: Check for empty appstate
    if (fullError.includes('empty appstate') || fullError.includes('EMPTY_APPSTATE')) {
        errorType = 'empty_appstate';
        errorMessage = chalk.red.bold('\n❌ APPSTATE FILE IS EMPTY\n\n') +
                      chalk.yellow('📝 Solution:\n') +
                      '  1. Your appstate.json file is empty\n' +
                      '  2. Add valid Facebook cookies to the file\n' +
                      '  3. Format should be JSON array: [{"key":"c_user", ...}]\n' +
                      '  4. Use cookie extension to get cookies from facebook.com\n' +
                      '  5. Restart the bot\n';
    }
    // Priority 2: Check for invalid JSON format
    else if (fullError.includes('JSON') && (fullError.includes('parse') || fullError.includes('Unexpected') || fullError.includes('position'))) {
        errorType = 'invalid_json';
        errorMessage = chalk.red.bold('\n❌ APPSTATE JSON FORMAT IS INVALID\n\n') +
                      chalk.yellow('📝 Problem:\n') +
                      '  • Your appstate.json has incorrect JSON format\n' +
                      '  • There might be syntax errors or missing brackets\n\n' +
                      chalk.yellow('📝 Solution:\n') +
                      '  1. Open appstate.json in a text editor\n' +
                      '  2. Check for proper JSON format\n' +
                      '  3. Use online JSON validator (jsonlint.com)\n' +
                      '  4. OR delete file and create fresh appstate.json\n' +
                      '  5. Get new cookies using browser extension\n' +
                      '  6. Restart the bot\n';
    }
    // Priority 3: Check for missing appstate file
    else if (fullError.includes('ENOENT') && (fullError.includes('appstate') || fullError.includes('Cannot find module'))) {
        errorType = 'missing_appstate';
        errorMessage = chalk.red.bold('\n❌ APPSTATE FILE MISSING\n\n') +
                      chalk.yellow('📝 Solution:\n') +
                      '  1. Create appstate.json file in your project root\n' +
                      '  2. Add your Facebook cookies to the file\n' +
                      '  3. Restart the bot\n';
    }
    // Priority 4: Check for runtime session expiration
    else if (fullError.includes('Runtime session expired') || 
             fullError.includes('Cannot read properties of undefined (reading \'uri\')')) {
        errorType = 'runtime_session_expired';
        errorMessage = chalk.red.bold('\n❌ SESSION EXPIRED DURING RUNTIME\n\n') +
                      chalk.yellow('📝 Problem:\n') +
                      '  • Your Facebook session expired while bot was running\n' +
                      '  • This happens when cookies become invalid after login\n\n' +
                      chalk.yellow('📝 Solution:\n') +
                      '  1. Open facebook.com in incognito/private browser\n' +
                      '  2. Login to your Facebook account\n' +
                      '  3. Use cookie extension to get fresh cookies\n' +
                      '  4. Replace appstate.json with new cookies\n' +
                      '  5. Restart the bot\n' +
                      '  6. If problem persists, check Facebook security settings\n';
    }
    // Priority 5: Check for expired/invalid cookies at login
    else if (fullError.includes('ErrAppState') || 
             fullError.includes('Wrong') || 
             fullError.includes('ctx')) {
        errorType = 'expired_cookies';
        errorMessage = chalk.red.bold('\n❌ APPSTATE COOKIES EXPIRED OR INVALID\n\n') +
                      chalk.yellow('📝 Solution:\n') +
                      '  1. Open facebook.com in incognito/private browser\n' +
                      '  2. Login to your Facebook account\n' +
                      '  3. Use cookie extension to get fresh cookies\n' +
                      '  4. Replace appstate.json with new cookies\n' +
                      '  5. Restart the bot\n';
    }
    // Priority 6: Check for 2FA errors
    else if (fullError.includes('2FA') || fullError.includes('TwoAuth') || fullError.includes('approvals')) {
        errorType = '2fa_error';
        errorMessage = chalk.red.bold('\n❌ TWO-FACTOR AUTHENTICATION ERROR\n\n') +
                      chalk.yellow('📝 Solution:\n') +
                      '  1. Make sure you entered correct 2FA code\n' +
                      '  2. Try using authenticator app code\n' +
                      '  3. Check PriyanshFca.json settings for Login2Fa\n';
    }
    // Priority 7: Check for checkpoint errors (excluding automation checkpoint which is auto-handled)
    else if ((fullError.includes('checkpoint') || fullError.includes('CheckPoint')) && !fullError.includes('601051028565049')) {
        errorType = 'checkpoint';
        errorMessage = chalk.red.bold('\n❌ FACEBOOK CHECKPOINT DETECTED\n\n') +
                      chalk.yellow('📝 Solution:\n') +
                      '  1. Open facebook.com in your browser\n' +
                      '  2. Complete any security verification required\n' +
                      '  3. Get NEW cookies after verification\n' +
                      '  4. Update appstate.json\n';
    }
    // Priority 8: Network error
    else if (fullError.includes('ECONNREFUSED') || 
             fullError.includes('ETIMEDOUT') || 
             fullError.includes('ENOTFOUND')) {
        errorType = 'network_error';
        errorMessage = chalk.red.bold('\n❌ NETWORK CONNECTION ERROR\n\n') +
                      chalk.yellow('📝 Solution:\n') +
                      '  1. Check your internet connection\n' +
                      '  2. Try again in a few moments\n' +
                      '  3. Check if Facebook is accessible\n';
    }
    // Priority 9: Invalid account credentials
    else if (fullError.includes('InvaildAccount') || fullError.includes('Wrong Password')) {
        errorType = 'invalid_credentials';
        errorMessage = chalk.red.bold('\n❌ INVALID ACCOUNT OR PASSWORD\n\n') +
                      chalk.yellow('📝 Solution:\n') +
                      '  1. Check your email/phone and password\n' +
                      '  2. Make sure account is not locked\n' +
                      '  3. Use appstate login instead\n';
    }
    
    // If we identified the error, show ONLY that one message
    if (errorMessage) {
        console.log('\n' + chalk.gray('='.repeat(60)));
        console.log(errorMessage);
        console.log(chalk.gray('='.repeat(60)) + '\n');
        
        // Call callback with simplified error
        if (callback && typeof callback === 'function') {
            callback({ error: errorType, message: errorMessage.replace(/\u001b\[\d+m/g, '') });
        }
        
        // Exit cleanly
        process.exit(1);
    } else {
        // Unknown error - show minimal info without stack trace spam
        console.log('\n' + chalk.gray('='.repeat(60)));
        console.log(chalk.red.bold('\n❌ LOGIN ERROR\n'));
        console.log(chalk.yellow('Error details:'), chalk.white(errorString.substring(0, 200)));
        console.log(chalk.gray('='.repeat(60)) + '\n');
        
        if (callback && typeof callback === 'function') {
            callback(error);
        }
        process.exit(1);
    }
}

module.exports = handleLoginError;
