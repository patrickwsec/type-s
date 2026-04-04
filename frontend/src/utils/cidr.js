/**
 * CIDR notation expansion utility.
 */

/**
 * Expand a CIDR notation string into individual IP addresses.
 * Limits to /24 or smaller (max 256 IPs).
 * If input is not CIDR, returns it as a single-element array.
 *
 * @param {string} cidr - IP address or CIDR (e.g. "192.168.1.0/24")
 * @returns {string[]} Array of individual IP addresses
 * @throws {Error} If CIDR notation is invalid or subnet is too large
 */
export const expandCIDR = (cidr) => {
  try {
    if (!cidr.includes('/')) {
      return [cidr];
    }

    const [baseIP, bits] = cidr.split('/');
    const maskBits = parseInt(bits);

    if (maskBits < 0 || maskBits > 32) {
      throw new Error('Invalid CIDR mask');
    }

    if (maskBits < 24) {
      throw new Error('Subnet too large. Please use /24 or smaller (max 256 IPs)');
    }

    const ipParts = baseIP.split('.').map(Number);
    if (ipParts.length !== 4 || ipParts.some(p => p < 0 || p > 255)) {
      throw new Error('Invalid IP address');
    }

    const numHosts = Math.pow(2, 32 - maskBits);

    const ipToNumber = (ip) => {
      return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    };

    const numberToIP = (num) => {
      return [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255
      ].join('.');
    };

    const baseNum = ipToNumber(baseIP);
    const ips = [];

    const start = maskBits === 32 ? 0 : 1;
    const end = maskBits === 32 ? 1 : numHosts - 1;

    for (let i = start; i < end; i++) {
      ips.push(numberToIP(baseNum + i));
    }

    return ips;
  } catch (error) {
    throw new Error(`Invalid CIDR notation: ${error.message}`);
  }
};
