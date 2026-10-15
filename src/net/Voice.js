import * as THREE from 'three';

/**
 * Voice
 * -----
 * Always-on proximity voice chat over WebRTC (peer to peer, mesh — fine for
 * the 4-player rooms). The room server only relays the signalling.
 *
 *  - your mic: echo cancellation + noise suppression + auto gain; V mutes
 *  - each remote voice plays from their avatar's head (THREE.PositionalAudio):
 *    louder up close, gone past ~45 m, silent if you're in different scenes
 *  - same vehicle: clear and close, whatever the distance math says
 *  - level meters (yours + theirs) drive the name-tag ♪ and her jaw
 *
 * Who calls whom: the peer with the smaller id sends the offer (no glare).
 */
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
if (import.meta.env.VITE_TURN_URL) {
  ICE.push({ urls: import.meta.env.VITE_TURN_URL, username: import.meta.env.VITE_TURN_USER, credential: import.meta.env.VITE_TURN_PASS });
}

export class Voice {
  constructor(mp) {
    this.mp = mp;
    this.game = mp.game;
    this.peers = new Map(); // id -> { pc, sound, analyser, el, gain }
    this.stream = null;
    this.muted = false;
    this.level = 0;
    this._buf = new Uint8Array(256);
  }

  async start() {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const ctx = this.game.audio.ctx;
    const src = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    src.connect(this.analyser); // meter only — never to the speakers
    for (const p of this.peers.values()) this.#addTracks(p.pc);
    // (re)negotiate with everyone we already know — they may have connected before our mic was ready
    for (const [id, p] of this.peers) if (this.mp.net.id < id || p.pc.remoteDescription) this.#offer(id);
    this.game.hud.toast('Voice is on. V to mute.', 3000);
  }

  setMuted(m) {
    this.muted = m;
    for (const t of this.stream?.getAudioTracks() ?? []) t.enabled = !m;
    this.game.hud.toast(m ? 'Mic muted.' : 'Mic on.', 1500);
  }

  connect(id) {
    if (this.peers.has(id)) return;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const peer = { pc, sound: null, analyser: null, el: null, level: 0 };
    this.peers.set(id, peer);
    pc.onicecandidate = (e) => e.candidate && this.mp.net.send('rtc', { to: id, d: { c: e.candidate } });
    pc.ontrack = (e) => this.#attach(id, peer, e.streams[0]);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') pc.restartIce?.();
    };
    if (this.stream) this.#addTracks(pc);
    if (this.mp.net.id < id && this.stream) this.#offer(id);
  }

  #addTracks(pc) {
    const have = pc.getSenders().some((s) => s.track);
    if (have) return;
    for (const t of this.stream.getAudioTracks()) pc.addTrack(t, this.stream);
  }

  async #offer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    this.mp.net.send('rtc', { to: id, d: { sdp: peer.pc.localDescription } });
  }

  async signal(from, d) {
    if (!this.peers.has(from)) this.connect(from);
    const peer = this.peers.get(from);
    const pc = peer.pc;
    try {
      if (d.sdp) {
        await pc.setRemoteDescription(d.sdp);
        if (d.sdp.type === 'offer') {
          if (this.stream) this.#addTracks(pc);
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          this.mp.net.send('rtc', { to: from, d: { sdp: pc.localDescription } });
        }
      } else if (d.c) await pc.addIceCandidate(d.c);
    } catch (e) {
      console.warn('[voice]', e);
    }
  }

  /** A remote voice arrived: route it to their avatar's head. */
  #attach(id, peer, stream) {
    const g = this.game;
    const ctx = g.audio.ctx;
    // Chrome only feeds WebRTC audio into WebAudio if a media element plays it.
    peer.el = new Audio();
    peer.el.muted = true;
    peer.el.srcObject = stream;
    peer.el.play().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    peer.gain = ctx.createGain();
    peer.analyser = ctx.createAnalyser();
    peer.analyser.fftSize = 512;
    src.connect(peer.analyser);
    src.connect(peer.gain);
    const sound = new THREE.PositionalAudio(g.audio.listener);
    sound.setRefDistance(2.5);
    sound.setRolloffFactor(1.4);
    sound.setMaxDistance(45);
    sound.setDistanceModel('linear');
    sound.setNodeSource(peer.gain);
    peer.sound = sound;
    const r = this.mp.remotes.get(id);
    if (r) {
      sound.position.y = r.avatar.height - 0.1;
      r.avatar.group.add(sound);
    }
  }

  drop(id) {
    const p = this.peers.get(id);
    if (!p) return;
    p.pc.close();
    p.sound?.parent?.remove(p.sound);
    p.el?.remove();
    this.peers.delete(id);
  }

  #meter(analyser) {
    analyser.getByteTimeDomainData(this._buf);
    let sum = 0;
    for (const v of this._buf) sum += ((v - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(sum / this._buf.length) * 6);
  }

  update(dt) {
    const g = this.game;
    if (g.input.pressed('KeyV') && !g.uiOpen) this.setMuted(!this.muted);
    this.level = this.analyser && !this.muted ? THREE.MathUtils.damp(this.level, this.#meter(this.analyser), 12, dt) : 0;
    const myVeh = g.vehicle.active ?? this.mp.ride?.veh ?? null;
    for (const [id, p] of this.peers) {
      if (!p.gain) continue;
      const r = this.mp.remotes.get(id);
      if (r && p.sound && p.sound.parent !== r.avatar.group) {
        p.sound.position.y = r.avatar.height - 0.1;
        r.avatar.group.add(p.sound);
      }
      // different scene = can't hear them; same vehicle = always clear
      const sameScene = r?.inMyScene;
      const sameVeh = myVeh && r?.state?.v?.id === myVeh.id;
      const target = !sameScene ? 0 : sameVeh ? 1.6 : 1;
      p.gain.gain.setTargetAtTime(target, g.audio.ctx.currentTime, 0.15);
      p.level = this.#meter(p.analyser);
    }
  }
}
