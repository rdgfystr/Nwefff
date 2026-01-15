/* eslint-disable linebreak-style */
'use strict';

const utils = require('../utils');
const log = require('npmlog');
const mqtt = require('mqtt');
const WebSocket = require('ws');
const HttpsProxyAgent = require('https-proxy-agent');
const EventEmitter = require('events');
const Duplexify = require('duplexify');
const { Transform } = require('stream');
var identity = function() {};
var form = {};
var getSeqID = function() {};
global.Fca = global.Fca || {};
global.Fca.Data = global.Fca.Data || {};
global.Fca.Data.MsgCount = new Map();
global.Fca.Data.event = new Map();

const topics = ['/ls_req', '/ls_resp', '/legacy_web', '/webrtc', '/rtc_multi', '/onevc', '/br_sr', '/sr_res', '/t_ms', '/thread_typing', '/orca_typing_notifications', '/notify_disconnect', '/orca_presence', '/inbox', '/mercury', '/messaging_events', '/orca_message_notifications', '/pp', '/webrtc_response'];

let WebSocket_Global;

function buildProxy() {
  const Proxy = new Transform({
    objectMode: false,
    transform(chunk, enc, next) {
      if (WebSocket_Global.readyState !== WebSocket_Global.OPEN) {
        return next();
      }
      let data;
      if (typeof chunk === 'string') data = Buffer.from(chunk, 'utf8');
      else data = chunk;
      WebSocket_Global.send(data);
      next();
    },
    flush(done) {
      WebSocket_Global.close();
      done();
    },
    writev(chunks, cb) {
      const buffers = chunks.map(({ chunk }) => typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
      this._write(Buffer.concat(buffers), 'binary', cb);
    },
  });
  return Proxy;
}

function buildStream(options, WebSocket, Proxy) {
  const Stream = Duplexify(undefined, undefined, options);
  Stream.socket = WebSocket;

  WebSocket.onclose = () => { Stream.end(); Stream.destroy(); };
  WebSocket.onerror = (err) => { Stream.destroy(err); };
  WebSocket.onmessage = (event) => {
    const data = event.data instanceof ArrayBuffer ? Buffer.from(event.data) : Buffer.from(event.data, 'utf8');
    Stream.push(data);
  };
  WebSocket.onopen = () => {
    Stream.setReadable(Proxy);
    Stream.setWritable(Proxy);
    Stream.emit('connect');
  };
  WebSocket_Global = WebSocket;
  Proxy.on('close', () => WebSocket.close());
  return Stream;
}

function listenMqtt(defaultFuncs, api, ctx, globalCallback) {
  const chatOn = ctx.globalOptions.online;
  const foreground = false;
  const sessionID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
  const GUID = utils.getGUID();
  const username = {
    u: ctx.userID, s: sessionID, chat_on: chatOn, fg: foreground, d: GUID, ct: 'websocket',
    aid: '219994525426954', aids: null, mqtt_sid: '', cp: 3, ecp: 10, st: [], pm: [], dc: '',
    no_auto_fg: true, gas: null, pack: [], p: null, php_override: ""
  };

  const cookies = ctx.jar.getCookies('https://www.facebook.com').join('; ');
  let host;
  if (ctx.mqttEndpoint) host = `${ctx.mqttEndpoint}&sid=${sessionID}&cid=${GUID}`;
  else if (ctx.region) host = `wss://edge-chat.facebook.com/chat?region=${ctx.region.toLowerCase()}&sid=${sessionID}&cid=${GUID}`;
  else host = `wss://edge-chat.facebook.com/chat?sid=${sessionID}&cid=${GUID}`;

  const options = {
    clientId: 'mqttwsclient', protocolId: 'MQIsdp', protocolVersion: 3,
    username: JSON.stringify(username), clean: true,
    wsOptions: {
      headers: { Cookie: cookies, Origin: 'https://www.facebook.com', 'User-Agent': ctx.globalOptions.userAgent, Referer: 'https://www.facebook.com/', Host: new URL(host).hostname },
      origin: 'https://www.facebook.com', protocolVersion: 13, binaryType: 'arraybuffer',
    },
    keepalive: 60, reschedulePings: true, reconnectPeriod: 3,
  };

  if (ctx.globalOptions.proxy !== undefined) {
    const agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
    options.wsOptions.agent = agent;
  }

  ctx.mqttClient = new mqtt.Client(() => buildStream(options, new WebSocket(host, options.wsOptions), buildProxy()), options);
  global.mqttClient = ctx.mqttClient;

  global.mqttClient.on('error', (err) => {
    log.error('listenMqtt', err);
    global.mqttClient.end();
    if (ctx.globalOptions.autoReconnect) getSeqID();
    else { globalCallback({ type: 'stop_listen', error: 'Server Down' }, null); return process.exit(1); }
  });

  global.mqttClient.on('connect', () => {
    topics.forEach((topicsub) => global.mqttClient.subscribe(topicsub));
    const queue = { sync_api_version: 11, max_deltas_able_to_process: 100, delta_batch_size: 500, encoding: 'JSON', entity_fbid: ctx.userID };
    const topic = "/messenger_sync_create_queue";
    queue.initial_titan_sequence_id = ctx.lastSeqId;
    queue.device_params = null;
    global.mqttClient.publish(topic, JSON.stringify(queue), { qos: 1, retain: false });
  });

  const HandleMessage = function(topic, message) {
    const jsonMessage = JSON.parse(message.toString());
    if (topic === "/t_ms") {
      if (jsonMessage.lastIssuedSeqId) ctx.lastSeqId = parseInt(jsonMessage.lastIssuedSeqId);
      for (var i in jsonMessage.deltas) {
        var delta = jsonMessage.deltas[i];
        parseDelta(defaultFuncs, api, ctx, globalCallback, { delta });
      }
    }
  };

  global.mqttClient.on('message', HandleMessage);
}

function parseDelta(defaultFuncs, api, ctx, globalCallback, { delta }) {
  if (delta.class === 'ClientPayload') {
    const clientPayload = utils.decodeClientPayload(delta.payload);
    if (clientPayload && clientPayload.deltas) {
      for (const d of clientPayload.deltas) {
        if (d.deltaMessageReply) {
          const msg = d.deltaMessageReply.message || {};
          let mentions = {};
          try {
            const prng = msg?.data?.prng ? JSON.parse(msg.data.prng) : [];
            for (const m of prng) if (m.i && m.o !== undefined && m.l !== undefined) mentions[m.i] = (msg.body || "").substr(m.o, m.l);
          } catch { mentions = {}; }

          const callbackToReturn = {
            type: "message_reply",
            threadID: (msg.messageMetadata.threadKey.threadFbId || msg.messageMetadata.threadKey.otherUserFbId).toString(),
            messageID: msg.messageMetadata.messageId,
            senderID: msg.messageMetadata.actorFbId.toString(),
            body: msg.body || "",
            args: (msg.body || "").trim().split(/\s+/),
            isGroup: !!msg.messageMetadata.threadKey.threadFbId,
            mentions,
            timestamp: parseInt(msg.messageMetadata.timestamp),
            participantIDs: (msg.participants || []).map(e => e.toString()),
            attachments: (msg.attachments || []).map(att => { try { const mercury = JSON.parse(att.mercuryJSON); Object.assign(att, mercury); return utils._formatAttachment(att); } catch { return att; } })
          };

          if (!ctx.globalOptions.selfListen && callbackToReturn.senderID === ctx.userID) return;
          globalCallback(null, callbackToReturn);
        }
      }
    }
  }
}

module.exports = function(defaultFuncs, api, ctx) {
  var globalCallback = identity;
  getSeqID = function getSeqID() {
    listenMqtt(defaultFuncs, api, ctx, globalCallback);
  };
  return function(callback) {
    class MessageEmitter extends EventEmitter {}
    var msgEmitter = new MessageEmitter();
    globalCallback = (callback || function(error, message) { if (error) return msgEmitter.emit("error", error); msgEmitter.emit("message", message); });
    getSeqID();
    return msgEmitter;
  };
};
