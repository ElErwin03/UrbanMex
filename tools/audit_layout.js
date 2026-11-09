#!/usr/bin/env node
/* Auditoría de la interfaz sobre un volcado de tools/dump_scene.js (usa --mobile para el modo celular):
 *   node tools/audit_layout.js volcado.json [--min-btn 44]
 * Avisa de: textos fuera de la pantalla, textos que se salen del panel donde empiezan, textos que se encimen entre sí y botones más chicos que --min-btn
 * (o que se encimen). Devuelve el número de avisos como código de salida (0 = todo bien). Es una aproximación: el ancho de un texto es letras x tamaño. */
const fs = require('fs');
const [file] = process.argv.slice(2); const mi = process.argv.indexOf('--min-btn'), MIN = mi > 0 ? +process.argv[mi + 1] : 44;
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const ui = d.objects.filter((o) => o.layer === 'UI');
const texts = ui.filter((o) => o.type === 'TextObject::Text' && String(o.text).trim()).map((o) => {
  const lines = String(o.text).split('\n'), w = Math.max(...lines.map((l) => l.length)) * o.size, h = lines.length * o.size;
  return { t: o.text.replace(/\n/g, ' / '), x: o.x, y: o.y, w, h, z: o.z, size: o.size };
});
const rects = []; ui.filter((o) => o.type === 'PrimitiveDrawing::Drawer').forEach((o) => o.ops.forEach((op) => { if (op.k === 'drawRectangle') { const [x0, y0, x1, y1] = op.a; rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, z: o.z }); } }));
const out = [], say = (m) => out.push(m);
const sh = (s) => s.t.length > 34 ? s.t.slice(0, 34) + '…' : s.t;
const hit = (a, b, e) => a.x + a.w > b.x + e && b.x + b.w > a.x + e && a.y + a.h > b.y + e && b.y + b.h > a.y + e;
texts.forEach((s) => {
  if (s.x < -1 || s.y < -1 || s.x + s.w > 1281 || s.y + s.h > 721) say('FUERA DE PANTALLA: "' + sh(s) + '" (' + Math.round(s.x) + ',' + Math.round(s.y) + ' ' + Math.round(s.w) + 'x' + Math.round(s.h) + ')');
  // panel contenedor: el rectángulo más chico (por debajo del texto en z) que contiene su esquina de origen; se ignoran los de pantalla casi completa
  const c = rects.filter((r) => r.z <= s.z && s.x >= r.x + 3 && s.y >= r.y - 1 && s.x < r.x + r.w && s.y < r.y + r.h && r.w < 1200 && r.w >= 40 && r.h >= 20).sort((a, b) => a.w * a.h - b.w * b.h)[0];
  if (c && (s.x + s.w > c.x + c.w + 1 || s.y + s.h > c.y + c.h + 1)) say('SE SALE DEL PANEL: "' + sh(s) + '" (texto ' + Math.round(s.x + s.w) + ',' + Math.round(s.y + s.h) + ' > panel ' + Math.round(c.x + c.w) + ',' + Math.round(c.y + c.h) + ')');
});
for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) if ((texts[i].z >= 300) === (texts[j].z >= 300) && hit(texts[i], texts[j], 2)) say('TEXTOS ENCIMADOS: "' + sh(texts[i]) + '" y "' + sh(texts[j]) + '"');
if (d.mobile) {
  const bs = (d.buttons || []).filter((b) => !b.disabled);
  bs.forEach((b) => { if (b.h < MIN || b.w < MIN) say('BOTON CHICO: ' + b.id + ' ' + b.w + 'x' + b.h + ' (minimo ' + MIN + ')'); });
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (!bs[i].modal === !bs[j].modal && hit(bs[i], bs[j], 1)) say('BOTONES ENCIMADOS: ' + bs[i].id + ' y ' + bs[j].id);
}
out.forEach((m) => console.log(m)); console.log(d.scene + ': ' + out.length + ' aviso(s)'); process.exit(Math.min(out.length, 255));
