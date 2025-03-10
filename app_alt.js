const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const WebSocket = require('ws');

(async function() {
  if (process.argv.length < 3) return;
  const userId = process.argv[2];
  let password = null;
  let seconds = null;
  let dlpath = "/home/twitcasting_hd";
  let last = null;
  let debug = false;
  for (let i = 3; i < process.argv.length; i++) {
    const argv = process.argv[i];
    if (last === '-p') password = argv;
    if (last === '-i') seconds = argv;
    if (argv.startsWith('-')) last = argv;
    if (argv === '-d') debug = true;
  }
  let id = null;
  let interval = 4000;
  let func = null;
  func = async function() {
    let data = null;
    while (true) {
      try {
        data = await checkOnline(userId, password);
        break;
      } catch(e) {
        console.log(e);
      }
    }
    if (data.live) {
      if (data.id != id) {
        id = data.id;
        const streamUrl = await getStreamUrl(userId, password);
        console.log(`${now()} DOWNLOAD START ${userId}_${id}.ts`);
	let datestamp = formatDate(new Date());
	let timestampu = formatTime(new Date());
        download(streamUrl, userId, path.join(`${dlpath}`, `${datestamp}_${timestampu}_${userId}_Twitcasting_HD.ts`));
      }
    } else {
      if (debug) console.debug(`${now()} ${userId} OFFLINE`);
    }
    interval = (seconds == null ? data.interval : parseInt(seconds, 10)) * 1000;
    setTimeout(func, interval);
  };
  setTimeout(func, interval);
})().catch(err => console.log(`${now()} ${err.message}`));

async function checkOnline(userId, password) {
  let url = `https://frontendapi.twitcasting.tv/users/${userId}/latest-movie`;
  if (password) {
    url += '?pass=' + md5(password);
  }
  const data = await (await fetch(url)).json();
  if (!data || !data.movie) return { live: false };
  return { live: data.movie.is_on_live, id: data.movie.id, interval: data.update_interval_sec };
}

async function getStreamUrl(userId, password) {
  const data = await (await fetch(`https://twitcasting.tv/streamserver.php?target=${userId}&mode=client`)).json();
  if (!data || !data.movie || !data.fmp4) throw new Error('NO_INFO_ERROR');
  if (!data.movie.live) throw new Error('NO_LIVE_ERROR');
  const proto = data.fmp4.proto;
  const host = data.fmp4.host;
  const mode = data.fmp4.source ? 'main' : data.fmp4.mobilesource ? 'mobilesource' : 'base';
  const movieId = data.movie.id;
  if (!proto || !host || !movieId) throw new Error('NO_STREAM_ERROR');
  let movieUrl = `${proto}://${host}/ws.app/stream/${movieId}/fmp4/bd/1/1500?mode=${mode}`;
  if (data.llfmp4 && data.llfmp4.streams && data.llfmp4.streams.main) {
    movieUrl = data.llfmp4.streams.main;
  }
  if (movieUrl && password) {
    movieUrl += (movieUrl.indexOf('?') === -1) ? '?' : '&';
    movieUrl += 'word=' + md5(password);
  }
  return movieUrl;
}

function download(streamUrl, userId, filePath) {
  const ws = new WebSocket(streamUrl, { origin: `https://twitcasting.tv/${userId}` });
  const duplex = WebSocket.createWebSocketStream(ws);
  const stream = fs.createWriteStream(filePath);
  duplex.pipe(stream);
}

function now() {
  return new Date().toLocaleString('ja', { timeZone: 'Japan' });
}

function md5(text) {
  return crypto.createHash('md5').update(text).digest("hex");
}

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('');
}

function formatTime(date) {
    var dd = new Date(date),
        hour = '' + dd.getHours(),
        minute = '' + dd.getMinutes();

    if (hour.length < 2) hour = '0' + hour;
    if (minute.length < 2) minute = '0' + minute;

    return [hour, minute].join('');
}
