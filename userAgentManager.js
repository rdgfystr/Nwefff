'use strict';

/**
 * User Agent Manager for FCA
 * Provides random, realistic user agents to avoid bot detection
 */

const uniqueRandomUserAgent = require('unique-random-useragent');

class UserAgentManager {
    constructor() {
        // Cache current user agent for session consistency
        this.currentUserAgent = null;
        this.lastRotationTime = null;
        this.rotationInterval = 3600000; // Rotate every 1 hour (in milliseconds)
        
        // Fallback user agents if package fails
        this.fallbackUserAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
        ];
    }
    
    /**
     * Prefer UA from PriyanshFca.json if provided
     */
    getCustomUserAgentFromConfig() {
        try {
            // global.Fca is initialized in fca-updated/index.js
            const customUA = global?.Fca?.Require?.Priyansh?.UserAgent;
            if (typeof customUA === 'string' && customUA.trim().length > 0) {
                return customUA.trim();
            }
        } catch {}
        return null;
    }

    /**
     * Get a random user agent
     * @returns {string} Random user agent string
     */
    getRandomUserAgent() {
        try {
            // Try to get from unique-random-useragent package
            const userAgent = uniqueRandomUserAgent.getRandomUserAgent();
            if (userAgent && userAgent.length > 0) {
                return userAgent;
            }
        } catch (error) {
            // If package fails, use fallback
            console.log('Using fallback user agent');
        }
        
        // Fallback to our list
        const randomIndex = Math.floor(Math.random() * this.fallbackUserAgents.length);
        return this.fallbackUserAgents[randomIndex];
    }
    
    /**
     * Get current user agent (with automatic rotation based on time)
     * @returns {string} Current user agent string
     */
    getUserAgent() {
        // If user defined UA in PriyanshFca.json, always use it and do not rotate
        const fromConfig = this.getCustomUserAgentFromConfig();
        if (fromConfig) {
            this.currentUserAgent = fromConfig;
            this.lastRotationTime = Date.now();
            return this.currentUserAgent;
        }

        const now = Date.now();
        
        // Check if we need to rotate (first time or interval passed)
        if (!this.currentUserAgent || 
            !this.lastRotationTime || 
            (now - this.lastRotationTime) > this.rotationInterval) {
            
            this.currentUserAgent = this.getRandomUserAgent();
            this.lastRotationTime = now;
        }
        
        return this.currentUserAgent;
    }
    
    /**
     * Force rotation of user agent
     * @returns {string} New user agent string
     */
    forceRotate() {
        // Respect custom UA if present
        const fromConfig = this.getCustomUserAgentFromConfig();
        if (fromConfig) {
            this.currentUserAgent = fromConfig;
            this.lastRotationTime = Date.now();
            return this.currentUserAgent;
        }
        this.currentUserAgent = this.getRandomUserAgent();
        this.lastRotationTime = Date.now();
        return this.currentUserAgent;
    }
    
    /**
     * Get a specific type of user agent
     * @param {string} type - 'chrome', 'firefox', 'safari', 'edge'
     * @returns {string} User agent of specified type
     */
    getUserAgentByType(type) {
        const types = {
            'chrome': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'firefox': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'safari': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'edge': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
        };
        
        // If custom UA provided, use it
        const fromConfig = this.getCustomUserAgentFromConfig();
        if (fromConfig) return fromConfig;
        
        return types[type.toLowerCase()] || this.getUserAgent();
    }
}

// Export singleton instance
module.exports = new UserAgentManager();
