import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
class SystemDetector {
  constructor() {
    this.cache = {};
  }
  detectRuntime() {
    if (this.cache.runtime) return this.cache.runtime;
    try {
      if (process.env.P_SERVER_UUID) return (this.cache.runtime = 'pterodactyl');
      if (process.env.PREFIX?.includes('com.termux')) return (this.cache.runtime = 'termux');
      if (process.env.KUBERNETES_SERVICE_HOST) return (this.cache.runtime = 'kubernetes');
      if (fs.existsSync('/.dockerenv')) return (this.cache.runtime = 'docker');
      if (fs.existsSync('/proc/self/cgroup')) {
        const cgroup = fs.readFileSync('/proc/self/cgroup', 'utf8');
        if (cgroup.includes('docker')) return (this.cache.runtime = 'docker');
        if (cgroup.includes('lxc')) return (this.cache.runtime = 'lxc');
        if (cgroup.includes('kubepods')) return (this.cache.runtime = 'kubernetes');
      }
      if (process.platform === 'linux' && fs.existsSync('/proc/version')) {
        const version = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
        if (version.includes('microsoft') || version.includes('wsl'))
          return (this.cache.runtime = 'wsl');
      }
      if (process.env.CODESPACES) return (this.cache.runtime = 'github-codespaces');
      if (process.env.GITPOD_WORKSPACE_ID) return (this.cache.runtime = 'gitpod');
      if (process.env.REPL_ID) return (this.cache.runtime = 'replit');
      if (process.env.GLITCH_PROJECT_ID) return (this.cache.runtime = 'glitch');
      if (process.env.RENDER) return (this.cache.runtime = 'render');
      if (process.env.VERCEL) return (this.cache.runtime = 'vercel');
      if (process.env.NETLIFY) return (this.cache.runtime = 'netlify');
      if (process.env.RAILWAY_ENVIRONMENT) return (this.cache.runtime = 'railway');
      if (process.env.FLY_APP_NAME) return (this.cache.runtime = 'fly.io');
      if (process.env.HEROKU_APP_ID) return (this.cache.runtime = 'heroku');
      if (process.platform === 'win32') return (this.cache.runtime = 'windows');
      if (process.platform === 'darwin') return (this.cache.runtime = 'macos');
      if (process.platform === 'linux') return (this.cache.runtime = 'linux');
      if (process.platform === 'freebsd') return (this.cache.runtime = 'freebsd');
      if (process.platform === 'openbsd') return (this.cache.runtime = 'openbsd');
      if (process.platform === 'android') return (this.cache.runtime = 'android');
      return (this.cache.runtime = 'unknown');
    } catch {
      return (this.cache.runtime = 'unknown');
    }
  }
  detectArchitecture() {
    if (this.cache.architecture) return this.cache.architecture;
    try {
      const arch = os.arch();
      const mapping = {
        x64: 'x86_64',
        arm64: 'aarch64',
        arm: 'armv7l',
        ia32: 'i686',
        mips: 'mips',
        mipsel: 'mipsel',
        ppc: 'powerpc',
        ppc64: 'ppc64',
        s390: 's390',
        s390x: 's390x',
      };
      return (this.cache.architecture = mapping[arch] || arch);
    } catch {
      return (this.cache.architecture = 'unknown');
    }
  }
  detectVirtualization() {
    if (this.cache.virtualization !== undefined) return this.cache.virtualization;
    try {
      if (process.platform !== 'linux') return (this.cache.virtualization = null);
      if (fs.existsSync('/sys/class/dmi/id/product_name')) {
        const product = fs
          .readFileSync('/sys/class/dmi/id/product_name', 'utf8')
          .toLowerCase()
          .trim();
        if (product.includes('virtualbox')) return (this.cache.virtualization = 'virtualbox');
        if (product.includes('vmware')) return (this.cache.virtualization = 'vmware');
        if (product.includes('kvm')) return (this.cache.virtualization = 'kvm');
        if (product.includes('qemu')) return (this.cache.virtualization = 'qemu');
        if (product.includes('xen')) return (this.cache.virtualization = 'xen');
        if (product.includes('bochs')) return (this.cache.virtualization = 'bochs');
        if (product.includes('parallels')) return (this.cache.virtualization = 'parallels');
      }
      if (fs.existsSync('/sys/hypervisor/type')) {
        const hypervisor = fs.readFileSync('/sys/hypervisor/type', 'utf8').toLowerCase().trim();
        if (hypervisor === 'xen') return (this.cache.virtualization = 'xen');
      }
      try {
        const systemd = execSync('systemd-detect-virt', {
          encoding: 'utf8',
          timeout: 1000,
        }).trim();
        if (systemd !== 'none') return (this.cache.virtualization = systemd);
      } catch {}
      return (this.cache.virtualization = null);
    } catch {
      return (this.cache.virtualization = null);
    }
  }
  detectCPUInfo() {
    if (this.cache.cpu) return this.cache.cpu;
    try {
      const cpus = os.cpus();
      return (this.cache.cpu = {
        model: cpus[0]?.model || 'unknown',
        cores: cpus.length,
        speed: `${cpus[0]?.speed || 0} MHz`,
      });
    } catch {
      return (this.cache.cpu = {
        model: 'unknown',
        cores: 0,
        speed: '0 MHz',
      });
    }
  }
  detectMemory() {
    try {
      const total = os.totalmem();
      const free = os.freemem();
      return {
        total: `${(total / 1024 / 1024 / 1024).toFixed(2)} GB`,
        free: `${(free / 1024 / 1024 / 1024).toFixed(2)} GB`,
        used: `${((total - free) / 1024 / 1024 / 1024).toFixed(2)} GB`,
        usagePercent: `${(((total - free) / total) * 100).toFixed(2)}%`,
      };
    } catch {
      return {
        total: '0 GB',
        free: '0 GB',
        used: '0 GB',
        usagePercent: '0%',
      };
    }
  }
  detectOS() {
    if (this.cache.os) return this.cache.os;
    try {
      return (this.cache.os = {
        platform: process.platform,
        type: os.type(),
        release: os.release(),
        hostname: os.hostname(),
        uptime: `${(os.uptime() / 3600).toFixed(2)} hours`,
      });
    } catch {
      return (this.cache.os = {
        platform: 'unknown',
        type: 'unknown',
        release: 'unknown',
        hostname: 'unknown',
        uptime: '0 hours',
      });
    }
  }
  detectNode() {
    if (this.cache.node) return this.cache.node;
    return (this.cache.node = {
      version: process.version,
      execPath: process.execPath,
    });
  }
  getAll() {
    return {
      runtime: this.detectRuntime(),
      architecture: this.detectArchitecture(),
      virtualization: this.detectVirtualization(),
      cpu: this.detectCPUInfo(),
      memory: this.detectMemory(),
      os: this.detectOS(),
      node: this.detectNode(),
    };
  }
  clearCache() {
    this.cache = {};
  }
  toJSON() {
    return this.getAll();
  }
}
const detector = new SystemDetector();
export default detector;
