import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { PATH } from '../utils/helper.js';
import { hkNet } from '../utils/network.js';
import { spawnProcess, combineToWebp, BINARIES } from '../utils/converter.js';
try {
  GlobalFonts.registerFromPath(`${PATH.font}/NotoColorEmoji-Regular.ttf`, 'NotoColorEmoji');
} catch {}
try {
  GlobalFonts.registerFromPath(`${PATH.font}/impact.ttf`, 'Impact');
} catch {}
try {
  GlobalFonts.registerFromPath(`${PATH.font}/SF-Pro-Display-Regular.otf`, 'sfProReguler');
} catch {}
function fitText(ctx, text, maxWidth, initialFontSize) {
  let fontSize = initialFontSize;
  do {
    ctx.font = `${fontSize}px Impact, NotoColorEmoji`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize--;
  } while (fontSize > 10);
  return ctx.font;
}
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  let lines = [];
  let currentLine = words[0];
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}
async function memeGenerate(imagePath, topText = '', bottomText = '') {
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.textAlign = 'center';
  ctx.lineWidth = Math.floor(image.height / 60);
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 5;
  const maxWidth = image.width * 0.9;
  let fontSize = Math.floor(image.height / 10);
  ctx.font = fitText(ctx, topText.toUpperCase(), maxWidth, fontSize);
  let lines = wrapText(ctx, topText.toUpperCase(), maxWidth);
  lines.forEach((line, i) => {
    const y = image.height * 0.1 + i * (image.height / 12);
    ctx.strokeText(line, image.width / 2, y);
    ctx.fillText(line, image.width / 2, y);
  });
  ctx.font = fitText(ctx, bottomText.toUpperCase(), maxWidth, fontSize);
  lines = wrapText(ctx, bottomText.toUpperCase(), maxWidth);
  lines.forEach((line, i) => {
    const y = image.height * 0.95 - (lines.length - i - 1) * (image.height / 12);
    ctx.strokeText(line, image.width / 2, y);
    ctx.fillText(line, image.width / 2, y);
  });
  ctx.shadowBlur = 0;
  return canvas.toBuffer('image/png');
}
async function memeGenerateAnimated(mediaBuffer, topText, bottomText, mimeType = 'video/mp4') {
  let ext;
  if (mimeType.includes('mp4')) {
    ext = 'mp4';
  } else if (mimeType.includes('gif')) {
    ext = 'gif';
  } else if (mimeType.includes('webp')) {
    ext = 'webp';
  } else {
    ext = 'mp4';
  }
  const uid = randomUUID();
  const tempInputPath = path.join(PATH.tmp, `input_${uid}.${ext}`);
  const tempDirName = `frames_${uid}`;
  const tempDir = path.join(PATH.tmp, tempDirName);
  const finalWebpPath = path.join(PATH.tmp, `output_${uid}.webp`);
  try {
    await fs.writeFile(tempInputPath, mediaBuffer);
    await fs.mkdir(tempDir, {
      recursive: true,
    });
    const args = [
      '-analyzeduration',
      '2147483647',
      '-probesize',
      '50M',
      '-i',
      tempInputPath,
      '-vf',
      'fps=15',
      path.join(tempDir, 'frame_%04d.png'),
    ];
    await spawnProcess(BINARIES.FFMPEG, args);
    const frameFiles = await fs.readdir(tempDir);
    for (const frameFile of frameFiles) {
      if (frameFile.startsWith('frame_') && frameFile.endsWith('.png')) {
        const framePath = path.join(tempDir, frameFile);
        const processedBuffer = await memeGenerate(framePath, topText, bottomText);
        const newFrameName = frameFile.replace('frame_', 'processed_frame_');
        const processedPath = path.join(tempDir, newFrameName);
        await fs.writeFile(processedPath, processedBuffer);
        await fs.unlink(framePath);
      }
    }
    await combineToWebp(tempDir, finalWebpPath);
    const finalWebpBuffer = await fs.readFile(finalWebpPath);
    return finalWebpBuffer;
  } finally {
    await fs
      .rm(tempDir, {
        recursive: true,
        force: true,
      })
      .catch(() => {});
    await fs.unlink(tempInputPath).catch(() => {});
    await fs.unlink(finalWebpPath).catch(() => {});
  }
}
class Rank {
  constructor(options) {
    this.font = {
      name: options?.font?.name ?? 'Manrope',
      path: options?.font?.path,
    };
    this.avatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
    this.overlay_opacity = 0.5;
    this.background = {
      type: 'color',
      background: '#23272a',
    };
    this.bar = {
      color: '#ff000',
    };
    this.discriminator = {
      data: '0000',
      color: '#23272a',
      display: false,
      size: 35,
    };
    this.username = {
      data: 'fivesobes',
      color: '#fff',
      size: 28,
    };
    this.level = {
      data: 1,
      display: false,
      text: 'Level',
      text_color: '#fff',
      number_color: '#fff',
      size: 20,
      data_size: 40,
    };
    this.rank = {
      data: 1,
      display: false,
      text: 'Rank',
      text_color: '#fff',
      number_color: '#fff',
      size: 20,
      data_size: 40,
    };
    this.current_xp = {
      data: 0,
      color: '#000',
    };
    this.required_xp = {
      data: 0,
      color: '#000',
    };
    this.status = null;
    this.border = null;
  }
  setAvatar(image) {
    this.avatar = image;
    if (!image) throw new Error('The argument of setAvatar method is not an image or an URL.');
    return this;
  }
  setBackground(type, value) {
    const types = ['color', 'image'];
    if (!type || typeof type !== 'string')
      throw new Error('The first argument of setBackground method is not a string.');
    if (!types.includes(type))
      throw new Error("The first argument of setBackground is not 'color' or 'image' type.");
    if (type === 'color' && !value)
      throw new Error('The second argument of setBackground method is not a hexadecimal color.');
    if (type === 'image' && !value)
      throw new Error('The second argument of setBackground method is not an image or an URL.');
    if (type === 'color' && !/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(value))
      throw new Error('The second argument of setBackground method is not a hexadecimal color.');
    this.background.type = type;
    this.background.background = value;
    return this;
  }
  setBarColor(color) {
    if (!color || typeof color !== 'string')
      throw new Error('The argument of setBarColor method is not a string.');
    if (!/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(color))
      throw new Error('The argument of setBarColor method is not a hexadecimal color.');
    this.bar.color = color;
    return this;
  }
  setBorder(color) {
    if (!color || typeof color !== 'string')
      throw new Error('The argument of setBorder method is not a string.');
    if (!/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(color))
      throw new Error('The argument of setBorder method is not a hexadecimal color.');
    this.border = color;
    return this;
  }
  setOverlayOpacity(opacity = 0.5) {
    if (typeof opacity !== 'number')
      throw new Error('The argument of setOverlayOpacity method is not a number.');
    if (opacity < 0 || opacity > 1)
      throw new Error(
        'The value of the opacity of setOverlayOpacity method is not between 0 and 1 (0 and 1 included).'
      );
    this.overlay_opacity = opacity;
    return this;
  }
  setLevel(data, text) {
    if (typeof data !== 'number')
      throw new Error('The first argument of setLevel method is not a number.');
    this.level.data = data;
    if (text) {
      if (typeof text !== 'string')
        throw new Error('The second argument of setLevel method is not a string.');
      this.level.text = text;
    }
    if (typeof data === 'number' || typeof text === 'string') this.level.display = true;
    return this;
  }
  setLevelColor({ text = '#fff', number = '#fff' }) {
    if (typeof text !== 'string')
      throw new Error('The first argument of setLevelColor method is not a string.');
    if (typeof number !== 'string')
      throw new Error('The second argument of setLevelColor method is not a string.');
    if (!/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(text))
      throw new Error('The first argument of setLevelColor method is not a hexadecimal color.');
    if (!/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(number))
      throw new Error('The second argument of setLevelColor method is not a hexadecimal color.');
    this.level.text_color = text;
    this.level.number_color = number;
    return this;
  }
  setRank(data, text) {
    if (typeof data !== 'number')
      throw new Error('The first argument of setRank method is not a number.');
    this.rank.data = data;
    if (text) {
      if (typeof text !== 'string')
        throw new Error('The second argument of setRank method is not a string.');
      this.rank.text = text;
    }
    if (typeof data === 'number' || typeof text === 'string') this.rank.display = true;
    return this;
  }
  setRankColor({ text = '#fff', number = '#fff' }) {
    if (typeof text !== 'string')
      throw new Error('The first argument of setRankColor method is not a string.');
    if (typeof number !== 'string')
      throw new Error('The second argument of setRankColor method is not a string.');
    if (!/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(text))
      throw new Error('The first argument of setRankColor method is not a hexadecimal color.');
    if (!/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(number))
      throw new Error('The second argument of setRankColor method is not a hexadecimal color.');
    this.rank.text_color = text;
    this.rank.number_color = number;
    return this;
  }
  setCurrentXp(xp, color = '#000') {
    if (typeof xp !== 'number')
      throw new Error('The first argument of setCurrentXp method is not a number.');
    if (!color || typeof color !== 'string')
      throw new Error('The second argument of setCurrentXp method is not a string.');
    if (!/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(color))
      throw new Error('The second argument of setCurrentXp method is not a hexadecimal color.');
    this.current_xp.data = xp;
    this.current_xp.color = color;
    return this;
  }
  setRequiredXp(xp, color = '#000') {
    if (typeof xp !== 'number')
      throw new Error('The first argument of setRequiredXp method is not a number.');
    if (!color || typeof color !== 'string')
      throw new Error('The second argument of setRequiredXp method is not a string.');
    if (!/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(color))
      throw new Error('The second argument of setRequiredXp method is not a hexadecimal color.');
    this.required_xp.data = xp;
    this.required_xp.color = color;
    return this;
  }
  setUsername(username, color = '#fff') {
    if (!username || typeof username !== 'string')
      throw new Error('The first argument of setUsername method is not a string.');
    if (!color || typeof color !== 'string')
      throw new Error('The second argument of setUsername method is not a string.');
    if (!/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(color))
      throw new Error('The second argument of setUsername method is not a hexadecimal color.');
    this.username.data = username;
    this.username.color = color;
    return this;
  }
  setStatus(status) {
    if (!status || typeof status !== 'string')
      throw new Error('The argument of setStatus method is not a string.');
    const statutes = {
      online: '#3ba55c',
      idle: '#faa61a',
      dnd: '#ed4245',
      stream: '#593695',
      offline: '#747f8e',
    };
    if (!statutes[status])
      throw new Error('The argument of setStatus method is not a valid status.');
    this.status = statutes[status];
    return this;
  }
  setCustomStatus(color) {
    if (!color || typeof color !== 'string')
      throw new Error('The argument of setCustomStatus method is not a string.');
    if (!/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(color))
      throw new Error('The argument of setCustomStatus method is not a hexadecimal color.');
    this.status = color;
    return this;
  }
  async build() {
    if (this.font.path) {
      try {
        GlobalFonts.registerFromPath(this.font.path, this.font.name);
      } catch {}
    }
    const max_xp_bar_width = 500;
    const xp_bar = Math.floor((this.current_xp.data / this.required_xp.data) * max_xp_bar_width);
    const canvas = createCanvas(850, 300);
    const ctx = canvas.getContext('2d');
    if (this.border) {
      ctx.beginPath();
      ctx.lineWidth = 8;
      ctx.strokeStyle = this.border;
      ctx.moveTo(55, 15);
      ctx.lineTo(canvas.width - 55, 15);
      ctx.quadraticCurveTo(canvas.width - 20, 20, canvas.width - 15, 55);
      ctx.lineTo(canvas.width - 15, canvas.height - 55);
      ctx.quadraticCurveTo(
        canvas.width - 20,
        canvas.height - 20,
        canvas.width - 55,
        canvas.height - 15
      );
      ctx.lineTo(55, canvas.height - 15);
      ctx.quadraticCurveTo(20, canvas.height - 20, 15, canvas.height - 55);
      ctx.lineTo(15, 55);
      ctx.quadraticCurveTo(20, 20, 55, 15);
      ctx.lineTo(56, 15);
      ctx.stroke();
      ctx.closePath();
    }
    ctx.beginPath();
    ctx.moveTo(65, 25);
    ctx.lineTo(canvas.width - 65, 25);
    ctx.quadraticCurveTo(canvas.width - 25, 25, canvas.width - 25, 65);
    ctx.lineTo(canvas.width - 25, canvas.height - 65);
    ctx.quadraticCurveTo(
      canvas.width - 25,
      canvas.height - 25,
      canvas.width - 65,
      canvas.height - 25
    );
    ctx.lineTo(65, canvas.height - 25);
    ctx.quadraticCurveTo(25, canvas.height - 25, 25, canvas.height - 65);
    ctx.lineTo(25, 65);
    ctx.quadraticCurveTo(25, 25, 65, 25);
    ctx.lineTo(66, 25);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 1;
    if (this.background.type === 'color') {
      ctx.beginPath();
      ctx.fillStyle = this.background.background;
      ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
    } else if (this.background.type === 'image') {
      try {
        ctx.drawImage(
          await loadImage(this.background.background),
          10,
          10,
          canvas.width - 20,
          canvas.height - 20
        );
      } catch {
        throw new Error(
          'The image given in the second parameter of the setBackground method is not valid or you are not connected to the internet.'
        );
      }
    }
    ctx.beginPath();
    ctx.globalAlpha = this.overlay_opacity;
    ctx.fillStyle = '#000';
    ctx.moveTo(75, 45);
    ctx.lineTo(canvas.width - 75, 45);
    ctx.quadraticCurveTo(canvas.width - 45, 45, canvas.width - 45, 75);
    ctx.lineTo(canvas.width - 45, canvas.height - 75);
    ctx.quadraticCurveTo(
      canvas.width - 45,
      canvas.height - 45,
      canvas.width - 75,
      canvas.height - 45
    );
    ctx.lineTo(75, canvas.height - 45);
    ctx.quadraticCurveTo(45, canvas.height - 45, 45, canvas.height - 75);
    ctx.lineTo(45, 75);
    ctx.quadraticCurveTo(45, 45, 75, 45);
    ctx.fill();
    ctx.closePath();
    ctx.globalAlpha = 1;
    ctx.font = `${this.username.size}px ${this.font.name} Bold`;
    ctx.fillStyle = this.username.color;
    ctx.textAlign = 'start';
    const username =
      this.username.data.length > 15 ? this.username.data.slice(0, 15) + '...' : this.username.data;
    ctx.fillText(`${username}`, 258, 125);
    let level_text_width = 0;
    let level_width = 0;
    if (this.level.display == true) {
      ctx.textAlign = 'end';
      ctx.fillStyle = this.level.text_color;
      ctx.font = `${this.level.data_size}px ${this.font.name} Bold`;
      ctx.fillText(this.level.data.toString().toUpperCase(), 250 + max_xp_bar_width, 90);
      level_width = ctx.measureText(this.level.data.toString()).width + 5;
      ctx.fillStyle = this.level.number_color;
      ctx.font = `${this.level.size}px ${this.font.name} Bold`;
      ctx.fillText(this.level.text.toUpperCase(), 250 + max_xp_bar_width - level_width, 90);
      level_text_width = ctx.measureText(this.level.text).width + 30;
    }
    if (this.rank.display == true) {
      ctx.textAlign = 'end';
      ctx.fillStyle = this.rank.text_color;
      ctx.font = `${this.rank.data_size}px ${this.font.name} Bold`;
      ctx.fillText(
        this.rank.data.toString().toUpperCase(),
        200 + max_xp_bar_width - level_text_width - level_width,
        90
      );
      const rank_width = ctx.measureText(this.rank.data.toString().toUpperCase()).width + 5;
      ctx.fillStyle = this.rank.number_color;
      ctx.font = `${this.rank.size}px ${this.font.name} Bold`;
      ctx.fillText(
        this.rank.text.toUpperCase(),
        200 + max_xp_bar_width - level_text_width - level_width - rank_width,
        90
      );
    }
    ctx.beginPath();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.fillStyle = '#efeded';
    ctx.moveTo(220, 135);
    ctx.lineTo(200 + max_xp_bar_width, 135);
    ctx.quadraticCurveTo(220 + max_xp_bar_width, 135, 220 + max_xp_bar_width, 152.5);
    ctx.quadraticCurveTo(220 + max_xp_bar_width, 170, 200 + max_xp_bar_width, 170);
    ctx.lineTo(220, 170);
    ctx.lineTo(220, 135);
    ctx.fill();
    ctx.closePath();
    ctx.beginPath();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.fillStyle = this.bar.color;
    ctx.moveTo(220, 135);
    ctx.lineTo(200 + xp_bar, 135);
    ctx.quadraticCurveTo(220 + xp_bar, 135, 220 + xp_bar, 152.5);
    ctx.quadraticCurveTo(220 + xp_bar, 170, 200 + xp_bar, 170);
    ctx.lineTo(220, 170);
    ctx.lineTo(220, 135);
    ctx.fill();
    ctx.textAlign = 'start';
    ctx.font = `23px ${this.font.name} Bold`;
    ctx.fillStyle = this.current_xp.color;
    ctx.fillText(`${this.current_xp.data}`, 590, 162);
    ctx.fillStyle = this.required_xp.color;
    ctx.fillText(
      ` / ${this.required_xp.data}`,
      590 + ctx.measureText(this.current_xp.data.toString()).width,
      162
    );
    ctx.closePath();
    if (this.status) {
      ctx.beginPath();
      ctx.globalAlpha = 1;
      ctx.arc(150, 150, 95, 0, Math.PI * 2);
      ctx.fillStyle = this.status;
      ctx.fill();
      ctx.closePath();
    }
    ctx.beginPath();
    ctx.arc(150, 150, this.status ? 90 : 95, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    try {
      if (this.status) {
        ctx.drawImage(await loadImage(this.avatar), 60, 60, 180, 180);
      } else {
        ctx.drawImage(await loadImage(this.avatar), 55, 55, 190, 190);
      }
    } catch {
      throw new Error(
        'The image given in the argument of the setAvatar method is not valid or you are not connected to the internet.'
      );
    }
    return canvas.toBuffer('image/png');
  }
}
class Top {
  constructor(options) {
    this.font = {
      name: options?.font?.name ?? 'Poppins',
      path: options?.font?.path,
    };
    this.usersData = options?.usersData || [
      {
        top: 1,
        avatar: 'https://i.pinimg.com/736x/c6/a8/5f/c6a85f7dbcbf367d5dc1baa2aaa19a73.jpg',
        tag: 'Beş#0005',
        score: 5,
      },
      {
        top: 2,
        avatar: 'https://i.pinimg.com/736x/c6/a8/5f/c6a85f7dbcbf367d5dc1baa2aaa19a73.jpg',
        tag: 'Beş#0005',
        score: 5,
      },
      {
        top: 3,
        avatar: 'https://i.pinimg.com/736x/c6/a8/5f/c6a85f7dbcbf367d5dc1baa2aaa19a73.jpg',
        tag: 'Beş#0005',
        score: 5,
      },
    ];
    this.background = {
      type: 'none',
      background: 'none',
    };
    this.abbreviateNumber = false;
    this.opacity = 0;
    this.scoreMessage = '';
    this.colors = options?.colors || {
      box: '#212121',
      username: '#ffffff',
      score: '#ffffff',
      firstRank: '#f7c716',
      secondRank: '#9e9e9e',
      thirdRank: '#94610f',
    };
  }
  setUsersData(usersData) {
    if (usersData.length > 10) {
      throw new Error('setUsersData values cannot be greater than 10.');
    }
    this.usersData = usersData;
    return this;
  }
  setScoreMessage(message) {
    this.scoreMessage = message;
    return this;
  }
  setColors(colors) {
    this.colors = colors;
    return this;
  }
  setabbreviateNumber(bool) {
    if (typeof bool !== 'boolean') {
      throw new Error('You must give a abbreviate number true or false argument.');
    }
    this.abbreviateNumber = bool;
    return this;
  }
  setOpacity(opacity = 0) {
    if (opacity) {
      if (opacity >= 0 && opacity <= 1) {
        this.opacity = opacity;
        return this;
      } else {
        throw new Error(
          'The value of the opacity of setOpacity method must be between 0 and 1 (0 and 1 included).'
        );
      }
    }
  }
  setBackground(type, value) {
    if (type === 'color') {
      if (value) {
        if (/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(value)) {
          this.background.type = 'color';
          this.background.background = value;
          return this;
        } else {
          throw new Error(
            'Invalid color for the second argument in setForeground method. You must give a hexadecimal color.'
          );
        }
      } else {
        throw new Error(
          'You must give a hexadecimal color as a second argument of setBackground method.'
        );
      }
    } else if (type === 'image') {
      if (value) {
        this.background.type = 'image';
        this.background.background = value;
        return this;
      } else {
        throw new Error('You must give a background URL as a second argument.');
      }
    } else {
      throw new Error("The first argument of setBackground must be 'color' or 'image'.");
    }
  }
  async build() {
    if (this.font.path) {
      try {
        GlobalFonts.registerFromPath(this.font.path, this.font.name);
      } catch {}
    }
    const fillRoundRect = (ctx, x, y, w, h, r, f, s) => {
      if (typeof r === 'number')
        r = {
          tl: r,
          tr: r,
          br: r,
          bl: r,
        };
      else {
        const defaultRadius = {
          tl: 0,
          tr: 0,
          br: 0,
          bl: 0,
        };
        for (const side in defaultRadius) {
          r[side] = r[side] || defaultRadius[side];
        }
      }
      ctx.beginPath();
      ctx.moveTo(x + r.tl, y);
      ctx.lineTo(x + w - r.tr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
      ctx.lineTo(x + w, y + h - r.br);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
      ctx.lineTo(x + r.bl, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
      ctx.lineTo(x, y + r.tl);
      ctx.quadraticCurveTo(x, y, x + r.tl, y);
      ctx.closePath();
      if (f) ctx.fill();
      if (s) ctx.stroke();
    };
    const abbreviateNumber = (value) => {
      let newValue = value;
      if (value >= 1000) {
        const suffixes = ['', 'K', 'M', 'B', 'T'];
        const suffixNum = Math.floor(('' + value).length / 3);
        let shortValue = '';
        for (let precision = 2; precision >= 1; precision--) {
          shortValue = parseFloat(
            (suffixNum !== 0 ? value / Math.pow(1000, suffixNum) : value).toPrecision(precision)
          );
          const dotLessShortValue = (shortValue + '').replace(/[^a-zA-Z 0-9]+/g, '');
          if (dotLessShortValue.length <= 2) {
            break;
          }
        }
        if (shortValue % 1 !== 0) shortValue = shortValue.toFixed(1);
        newValue = shortValue + suffixes[suffixNum];
      }
      return newValue;
    };
    const yuksek = this.usersData.length * 74.5;
    const canvas = createCanvas(680, yuksek);
    const ctx = canvas.getContext('2d');
    ctx.globalAlpha = 1;
    if (this.background.type === 'color') {
      ctx.beginPath();
      ctx.fillStyle = this.background.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (this.background.type === 'image') {
      try {
        ctx.drawImage(
          await loadImage(this.background.background),
          0,
          0,
          canvas.width,
          canvas.height
        );
      } catch {
        throw new Error(
          'The image given in the second parameter of the setBackground method is not valid or you are not connected to the internet.'
        );
      }
    }
    if (this.usersData) {
      let Box_Y = 0,
        Avatar_Y = 0,
        Tag_Y = 45,
        XP_Y = 45,
        Level_Y = 30,
        Rank_Y = 45;
      for (let i = 0; i < this.usersData.length; i++) {
        ctx.save();
        ctx.fillStyle = this.colors.box;
        ctx.globalAlpha = this.opacity;
        fillRoundRect(ctx, 0, Box_Y, canvas.width, 70, 15, true, false);
        ctx.globalAlpha = 1;
        const avatar = await loadImage(this.usersData[i].avatar);
        ctx.clip();
        ctx.drawImage(avatar, 0, Avatar_Y, 70, 70);
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 8;
        ctx.shadowOffsetY = 6;
        ctx.shadowColor = '#0a0a0a';
        ctx.fillStyle = this.colors.username;
        ctx.font = `bold 25px ${this.font.name}`;
        ctx.textAlign = 'left';
        ctx.fillText(this.usersData[i].tag, 80, Tag_Y, 260);
        ctx.fillStyle = this.colors.score;
        ctx.font = `bold 20px ${this.font.name}`;
        ctx.textAlign = 'right';
        ctx.fillText(
          `${this.scoreMessage} ${this.abbreviateNumber === true ? `${abbreviateNumber(this.usersData[i].score)}` : `${this.usersData[i].score}`}`,
          560,
          XP_Y,
          200
        );
        if (this.usersData[i].top === 1) {
          ctx.fillStyle = this.colors.firstRank;
        } else if (this.usersData[i].top === 2) {
          ctx.fillStyle = this.colors.secondRank;
        } else if (this.usersData[i].top === 3) {
          ctx.fillStyle = this.colors.thirdRank;
        }
        ctx.font = `bold 30px ${this.font.name}`;
        ctx.textAlign = 'right';
        ctx.fillText('#' + this.usersData[i].top, 660, Rank_Y, 75);
        Box_Y = Box_Y + 75;
        Avatar_Y = Avatar_Y + 75;
        Tag_Y = Tag_Y + 75;
        XP_Y = XP_Y + 75;
        Level_Y = Level_Y + 75;
        Rank_Y = Rank_Y + 75;
        ctx.restore();
      }
    } else {
      ctx.font = `bold 40px ${this.font.name}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 8;
      ctx.shadowOffsetY = 6;
      ctx.shadowColor = '#0a0a0a';
      ctx.fillText('Not found!', 340, 370, 500);
    }
    return canvas.toBuffer('image/png');
  }
}
async function createRoastSticker(text1, text2, text3) {
  const width = 512;
  const height = 512;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const marginXText = 70;
  const marginXTitle = 30;
  const maxWidthTop = width - marginXText * 2;
  const maxWidthTitle = width - marginXTitle * 2;
  const maxWidthBottom = width - marginXText * 2;
  const lineHeightSmall = 34;
  const spacingAfterT1 = 14;
  const spacingAfterT2 = 18;
  const maxTitleLines = 2;
  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const testLine = line ? line + ' ' + words[i] : words[i];
      const { width } = ctx.measureText(testLine);
      if (width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  ctx.font = '28px sans-serif';
  let lines1 = wrapText(ctx, text1, maxWidthTop);
  const heightT1 = lines1.length * lineHeightSmall;
  let fontSizeTitle = 60;
  let lines2;
  while (fontSizeTitle > 30) {
    ctx.font = `bold ${fontSizeTitle}px sans-serif`;
    lines2 = wrapText(ctx, text2, maxWidthTitle);
    if (lines2.length <= maxTitleLines) break;
    fontSizeTitle -= 2;
  }
  const lineHeightTitle = fontSizeTitle + 6;
  const heightT2 = lines2.length * lineHeightTitle;
  ctx.font = '28px sans-serif';
  let lines3 = wrapText(ctx, text3, maxWidthBottom);
  const heightT3 = lines3.length * lineHeightSmall;
  const totalHeight = heightT1 + spacingAfterT1 + heightT2 + spacingAfterT2 + heightT3;
  let y = (height - totalHeight) / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#6b7280';
  ctx.font = '28px sans-serif';
  for (const line of lines1) {
    ctx.fillText(line, marginXText, y);
    y += lineHeightSmall;
  }
  y += spacingAfterT1;
  ctx.fillStyle = '#000';
  ctx.font = `bold ${fontSizeTitle}px sans-serif`;
  for (const line of lines2) {
    ctx.fillText(line, marginXTitle, y);
    y += lineHeightTitle;
  }
  y += spacingAfterT2;
  ctx.fillStyle = '#6b7280';
  ctx.font = '28px sans-serif';
  for (const line of lines3) {
    ctx.fillText(line, marginXText, y);
    y += lineHeightSmall;
  }
  const imgBuffer = canvas.toBuffer('image/png');
  return await imgBuffer;
}
async function generateIQC(text, time, options = {}) {
  const width = 680;
  const height = 1100;
  const config = {
    baterai: options.baterai !== undefined ? options.baterai : [true, '100'],
    operator: options.operator !== undefined ? options.operator : true,
    timebar: options.timebar !== undefined ? options.timebar : true,
    wifi: options.wifi !== undefined ? options.wifi : true,
  };
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imgBuffer = (
    await hkNet.get('https://files.catbox.moe/v7x00l.jpg', {
      responseType: 'arraybuffer',
      timeout: 15000,
    })
  ).data;
  const backgroundImg = await loadImage(imgBuffer);
  const scale = 1.05;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const offsetX = (width - scaledWidth) / 2;
  const offsetY = (height - scaledHeight) / 2;
  ctx.save();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.drawImage(backgroundImg, offsetX, offsetY, scaledWidth, scaledHeight);
  ctx.filter = 'blur(6px)';
  ctx.drawImage(backgroundImg, offsetX, offsetY, scaledWidth, scaledHeight);
  ctx.filter = 'none';
  ctx.restore();
  ctx.fillStyle = 'rgba(13, 13, 13, 0.7)';
  ctx.fillRect(0, 0, width, height);
  if (config.timebar || config.operator || config.baterai[0] || config.wifi) {
    const statusBarY = 30;
    if (config.timebar) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sfProReguler';
      ctx.fillText(time, 30, statusBarY);
    }
    let currentX = width - 30;
    ctx.textAlign = 'right';
    if (config.baterai[0]) {
      const drawBatteryWithText = (x, y, percentage) => {
        const batteryLevel = Math.min(100, Math.max(0, parseInt(percentage)));
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        const batteryWidth = 40;
        const batteryHeight = 24;
        const bodyRadius = 3.5;
        ctx.beginPath();
        ctx.moveTo(x - batteryWidth + bodyRadius, y - batteryHeight / 2);
        ctx.lineTo(x - bodyRadius, y - batteryHeight / 2);
        ctx.quadraticCurveTo(x, y - batteryHeight / 2, x, y - batteryHeight / 2 + bodyRadius);
        ctx.lineTo(x, y + batteryHeight / 2 - bodyRadius);
        ctx.quadraticCurveTo(x, y + batteryHeight / 2, x - bodyRadius, y + batteryHeight / 2);
        ctx.lineTo(x - batteryWidth + bodyRadius, y + batteryHeight / 2);
        ctx.quadraticCurveTo(
          x - batteryWidth,
          y + batteryHeight / 2,
          x - batteryWidth,
          y + batteryHeight / 2 - bodyRadius
        );
        ctx.lineTo(x - batteryWidth, y - batteryHeight / 2 + bodyRadius);
        ctx.quadraticCurveTo(
          x - batteryWidth,
          y - batteryHeight / 2,
          x - batteryWidth + bodyRadius,
          y - batteryHeight / 2
        );
        ctx.closePath();
        ctx.stroke();
        const tipWidth = 3.5;
        const tipHeight = 13;
        const tipRadius = 1.75;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x, y - tipHeight / 2 + tipRadius);
        ctx.quadraticCurveTo(x, y - tipHeight / 2, x + tipRadius, y - tipHeight / 2);
        ctx.lineTo(x + tipWidth - tipRadius, y - tipHeight / 2);
        ctx.quadraticCurveTo(
          x + tipWidth,
          y - tipHeight / 2,
          x + tipWidth,
          y - tipHeight / 2 + tipRadius
        );
        ctx.lineTo(x + tipWidth, y + tipHeight / 2 - tipRadius);
        ctx.quadraticCurveTo(
          x + tipWidth,
          y + tipHeight / 2,
          x + tipWidth - tipRadius,
          y + tipHeight / 2
        );
        ctx.lineTo(x + tipRadius, y + tipHeight / 2);
        ctx.quadraticCurveTo(x, y + tipHeight / 2, x, y + tipHeight / 2 - tipRadius);
        ctx.closePath();
        ctx.fill();
        const fillMargin = 3.5;
        const fillWidth = ((batteryWidth - fillMargin * 2) * batteryLevel) / 100;
        const fillHeight = batteryHeight - fillMargin * 2;
        const fillRadius = 2;
        ctx.fillStyle = batteryLevel <= 20 ? '#ff3b30' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x - batteryWidth + fillMargin + fillRadius, y - fillHeight / 2);
        ctx.lineTo(x - batteryWidth + fillMargin + fillWidth - fillRadius, y - fillHeight / 2);
        ctx.quadraticCurveTo(
          x - batteryWidth + fillMargin + fillWidth,
          y - fillHeight / 2,
          x - batteryWidth + fillMargin + fillWidth,
          y - fillHeight / 2 + fillRadius
        );
        ctx.lineTo(x - batteryWidth + fillMargin + fillWidth, y + fillHeight / 2 - fillRadius);
        ctx.quadraticCurveTo(
          x - batteryWidth + fillMargin + fillWidth,
          y + fillHeight / 2,
          x - batteryWidth + fillMargin + fillWidth - fillRadius,
          y + fillHeight / 2
        );
        ctx.lineTo(x - batteryWidth + fillMargin + fillRadius, y + fillHeight / 2);
        ctx.quadraticCurveTo(
          x - batteryWidth + fillMargin,
          y + fillHeight / 2,
          x - batteryWidth + fillMargin,
          y + fillHeight / 2 - fillRadius
        );
        ctx.lineTo(x - batteryWidth + fillMargin, y - fillHeight / 2 + fillRadius);
        ctx.quadraticCurveTo(
          x - batteryWidth + fillMargin,
          y - fillHeight / 2,
          x - batteryWidth + fillMargin + fillRadius,
          y - fillHeight / 2
        );
        ctx.closePath();
        ctx.fill();
        ctx.font = 'bold 14px sfProReguler';
        ctx.fillStyle = batteryLevel <= 20 ? '#ffffff' : '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(percentage, x - batteryWidth / 2, y + 4);
        ctx.textAlign = 'right';
      };
      drawBatteryWithText(currentX, statusBarY - 7, config.baterai[1]);
      currentX -= 48;
    }
    if (config.wifi) {
      const wifiSize = 1.3;
      const wifiY = statusBarY - 22;
      ctx.save();
      ctx.translate(currentX - 32, wifiY);
      ctx.scale(wifiSize, wifiSize);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(1.5, 9);
      ctx.bezierCurveTo(1.5, 9, 5.5, 4.5, 12, 4.5);
      ctx.bezierCurveTo(18.5, 4.5, 22.5, 9, 22.5, 9);
      ctx.lineTo(19.5, 11.5);
      ctx.bezierCurveTo(19.5, 11.5, 16, 8.2, 12, 8.2);
      ctx.bezierCurveTo(8, 8.2, 4.5, 11.5, 4.5, 11.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5.5, 13);
      ctx.bezierCurveTo(5.5, 13, 8.5, 10.5, 12, 10.5);
      ctx.bezierCurveTo(15.5, 10.5, 18.5, 13, 18.5, 13);
      ctx.lineTo(16, 15);
      ctx.bezierCurveTo(16, 15, 13.5, 13.5, 12, 13.5);
      ctx.bezierCurveTo(10.5, 13.5, 8, 15, 8, 15);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(9, 16.5);
      ctx.quadraticCurveTo(10, 16, 12, 16);
      ctx.quadraticCurveTo(14, 16, 15, 16.5);
      ctx.lineTo(12.3, 19.7);
      ctx.quadraticCurveTo(12, 20, 12, 20);
      ctx.quadraticCurveTo(12, 20, 11.7, 19.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      currentX -= 35;
    }
    if (config.operator) {
      const drawSignal = (x, y) => {
        ctx.fillStyle = '#ffffff';
        const bars = [7, 11, 16, 21];
        const barWidth = 3.5;
        const barSpacing = 5.5;
        const radius = 1.5;
        for (let i = 0; i < 4; i++) {
          const barHeight = bars[i];
          const barX = x + i * barSpacing;
          const barY = y + (21 - barHeight);
          ctx.beginPath();
          ctx.moveTo(barX, y + 21);
          ctx.lineTo(barX, barY + radius);
          ctx.quadraticCurveTo(barX, barY, barX + radius, barY);
          ctx.lineTo(barX + barWidth - radius, barY);
          ctx.quadraticCurveTo(barX + barWidth, barY, barX + barWidth, barY + radius);
          ctx.lineTo(barX + barWidth, y + 21);
          ctx.closePath();
          ctx.fill();
        }
      };
      drawSignal(currentX - 25, statusBarY - 16);
      currentX -= 35;
    }
    ctx.textAlign = 'left';
  }
  const fontSize = 24;
  const maxBubbleWidth = 540;
  const minBubbleWidth = 100;
  const padding = 40;
  const lineHeight = 32;
  ctx.font = `${fontSize}px sfProReguler, NotoColorEmoji`;
  function wrapText(text, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');
    for (const paragraph of paragraphs) {
      const words = paragraph.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }
    return lines;
  }
  const lines = wrapText(text, maxBubbleWidth - padding);
  let maxLineWidth = 0;
  for (const line of lines) {
    const metrics = ctx.measureText(line);
    maxLineWidth = Math.max(maxLineWidth, metrics.width);
  }
  const bubbleWidth = Math.max(
    minBubbleWidth,
    Math.min(maxBubbleWidth, maxLineWidth + padding + 58)
  );
  const bubbleHeight = Math.max(60, lines.length * lineHeight + 22);
  const bubbleX = 22;
  const menuY = 430;
  const bubbleY = menuY - bubbleHeight - 20;
  const radius = 26;
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.moveTo(bubbleX + radius, bubbleY);
  ctx.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
  ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius);
  ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius);
  ctx.quadraticCurveTo(
    bubbleX + bubbleWidth,
    bubbleY + bubbleHeight,
    bubbleX + bubbleWidth - radius,
    bubbleY + bubbleHeight
  );
  ctx.lineTo(bubbleX + radius, bubbleY + bubbleHeight);
  ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - radius);
  ctx.lineTo(bubbleX, bubbleY + radius);
  ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `${fontSize}px sfProReguler, NotoColorEmoji`;
  let y = bubbleY + 34;
  for (const line of lines) {
    ctx.fillText(line, bubbleX + 24, y);
    y += lineHeight;
  }
  ctx.fillStyle = '#999999';
  ctx.font = '18px sfProReguler';
  ctx.textAlign = 'right';
  ctx.fillText(time, bubbleX + bubbleWidth - 14, bubbleY + bubbleHeight - 8);
  ctx.textAlign = 'left';
  const menuX = 20;
  const menuWidth = 490;
  const menuHeight = 560;
  const menuRadius = 15;
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.moveTo(menuX + menuRadius, menuY);
  ctx.lineTo(menuX + menuWidth - menuRadius, menuY);
  ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + menuRadius);
  ctx.lineTo(menuX + menuWidth, menuY + menuHeight - menuRadius);
  ctx.quadraticCurveTo(
    menuX + menuWidth,
    menuY + menuHeight,
    menuX + menuWidth - menuRadius,
    menuY + menuHeight
  );
  ctx.lineTo(menuX + menuRadius, menuY + menuHeight);
  ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - menuRadius);
  ctx.lineTo(menuX, menuY + menuRadius);
  ctx.quadraticCurveTo(menuX, menuY, menuX + menuRadius, menuY);
  ctx.closePath();
  ctx.fill();
  const drawStar = (x, y) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outer = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const inner = ((i * 2 + 1) * Math.PI) / 5 - Math.PI / 2;
      const ox = x + Math.cos(outer) * 16;
      const oy = y + Math.sin(outer) * 16;
      const ix = x + Math.cos(inner) * 7;
      const iy = y + Math.sin(inner) * 7;
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
      ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.stroke();
  };
  const drawReply = (x, y) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const offsetX = x - 3;
    ctx.moveTo(offsetX, y - 6);
    ctx.lineTo(offsetX, y - 13);
    ctx.lineTo(offsetX - 13, y);
    ctx.lineTo(offsetX, y + 13);
    ctx.lineTo(offsetX, y + 6);
    ctx.bezierCurveTo(offsetX + 9, y + 6, offsetX + 16, y + 9, offsetX + 20, y + 16);
    ctx.bezierCurveTo(offsetX + 18, y + 7, offsetX + 14, y - 2, offsetX, y - 6);
    ctx.stroke();
  };
  const drawForward = (x, y) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const offsetX = x + 3;
    ctx.moveTo(offsetX, y - 6);
    ctx.lineTo(offsetX, y - 13);
    ctx.lineTo(offsetX + 13, y);
    ctx.lineTo(offsetX, y + 13);
    ctx.lineTo(offsetX, y + 6);
    ctx.bezierCurveTo(offsetX - 9, y + 6, offsetX - 16, y + 9, offsetX - 20, y + 16);
    ctx.bezierCurveTo(offsetX - 18, y + 7, offsetX - 14, y - 2, offsetX, y - 6);
    ctx.stroke();
  };
  const drawCopy = (x, y) => {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const scale = 0.23;
    const offsetX = -127;
    const offsetY = -105;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(offsetX + 164, offsetY + 156);
    ctx.bezierCurveTo(
      offsetX + 164,
      offsetY + 164,
      offsetX + 158,
      offsetY + 170,
      offsetX + 150,
      offsetY + 170
    );
    ctx.lineTo(offsetX + 74, offsetY + 170);
    ctx.bezierCurveTo(
      offsetX + 66,
      offsetY + 170,
      offsetX + 60,
      offsetY + 164,
      offsetX + 60,
      offsetY + 156
    );
    ctx.lineTo(offsetX + 60, offsetY + 80);
    ctx.bezierCurveTo(
      offsetX + 60,
      offsetY + 72,
      offsetX + 66,
      offsetY + 66,
      offsetX + 74,
      offsetY + 66
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offsetX + 90, offsetY + 54);
    ctx.bezierCurveTo(
      offsetX + 90,
      offsetY + 46,
      offsetX + 96,
      offsetY + 40,
      offsetX + 104,
      offsetY + 40
    );
    ctx.lineTo(offsetX + 180, offsetY + 40);
    ctx.bezierCurveTo(
      offsetX + 188,
      offsetY + 40,
      offsetX + 194,
      offsetY + 46,
      offsetX + 194,
      offsetY + 54
    );
    ctx.lineTo(offsetX + 194, offsetY + 130);
    ctx.bezierCurveTo(
      offsetX + 194,
      offsetY + 138,
      offsetX + 188,
      offsetY + 144,
      offsetX + 180,
      offsetY + 144
    );
    ctx.lineTo(offsetX + 104, offsetY + 144);
    ctx.bezierCurveTo(
      offsetX + 96,
      offsetY + 144,
      offsetX + 90,
      offsetY + 138,
      offsetX + 90,
      offsetY + 130
    );
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };
  const drawComment = (x, y) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const width = 30;
    const height = 22;
    const radius = 4;
    ctx.beginPath();
    ctx.moveTo(x - width / 2 + radius, y - height / 2);
    ctx.lineTo(x + width / 2 - radius, y - height / 2);
    ctx.quadraticCurveTo(x + width / 2, y - height / 2, x + width / 2, y - height / 2 + radius);
    ctx.lineTo(x + width / 2, y + height / 2 - radius);
    ctx.quadraticCurveTo(x + width / 2, y + height / 2, x + width / 2 - radius, y + height / 2);
    ctx.lineTo(x - width / 2 + 8, y + height / 2);
    ctx.lineTo(x - width / 2 + 3, y + height / 2 + 6);
    ctx.lineTo(x - width / 2 + 4, y + height / 2);
    ctx.lineTo(x - width / 2 + radius, y + height / 2);
    ctx.quadraticCurveTo(x - width / 2, y + height / 2, x - width / 2, y + height / 2 - radius);
    ctx.lineTo(x - width / 2, y - height / 2 + radius);
    ctx.quadraticCurveTo(x - width / 2, y - height / 2, x - width / 2 + radius, y - height / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    const dotSize = 2;
    const dotSpacing = 6;
    ctx.beginPath();
    ctx.arc(x - dotSpacing, y, dotSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, dotSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + dotSpacing, y, dotSize, 0, Math.PI * 2);
    ctx.fill();
  };
  const drawReport = (x, y) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x - 15, y + 12);
    ctx.lineTo(x + 15, y + 12);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y - 5, 2, 11);
    ctx.beginPath();
    ctx.arc(x, y + 8, 1.5, 0, Math.PI * 2);
    ctx.fill();
  };
  const drawTrash = (x, y) => {
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 13);
    ctx.lineTo(x + 15, y - 13);
    ctx.stroke();
    ctx.strokeRect(x - 8, y - 18, 16, 5);
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 11);
    ctx.lineTo(x - 9, y + 13);
    ctx.lineTo(x + 9, y + 13);
    ctx.lineTo(x + 12, y - 11);
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x, y + 11);
    ctx.moveTo(x - 7, y - 5);
    ctx.lineTo(x - 5, y + 11);
    ctx.moveTo(x + 7, y - 5);
    ctx.lineTo(x + 5, y + 11);
    ctx.stroke();
  };
  const items = [
    {
      text: 'Beri Bintang',
      icon: drawStar,
    },
    {
      text: 'Balas',
      icon: drawReply,
    },
    {
      text: 'Teruskan',
      icon: drawForward,
    },
    {
      text: 'Salin',
      icon: drawCopy,
    },
    {
      text: 'Ucapkan',
      icon: drawComment,
    },
    {
      text: 'Laporkan',
      icon: drawReport,
    },
    {
      text: 'Hapus',
      icon: drawTrash,
      color: '#ff3b30',
    },
  ];
  items.forEach((item, i) => {
    const itemY = menuY + i * 80;
    ctx.fillStyle = item.color || '#ffffff';
    ctx.font = '28px sfProReguler';
    ctx.fillText(item.text, menuX + 30, itemY + 50);
    item.icon(menuX + menuWidth - 40, itemY + 40);
    if (i < items.length - 1) {
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(menuX + 25, itemY + 80);
      ctx.lineTo(menuX + menuWidth - 25, itemY + 80);
      ctx.stroke();
    }
  });
  const buffer = canvas.toBuffer('image/png');
  return {
    success: true,
    image: buffer,
    mimeType: 'image/png',
    timestamp: Date.now(),
    message: 'Created by Hann Universe npm:iqc-canvas',
  };
}
export { memeGenerate, memeGenerateAnimated, Rank, Top, createRoastSticker, generateIQC };
