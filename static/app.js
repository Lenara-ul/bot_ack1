const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtDate = d => d ? d.split("-").reverse().join(".") : "";
async function api(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) { let m = "Ошибка сервера"; try { m = (await r.json()).detail; } catch {} throw new Error(m); }
  return r.json();
}
const badge = s => `<span class="b ${s === "оформлен" ? "ok" : ""}">${esc(s)}</span>`;

// ---------- Реестр ----------
async function initRegistry() {
  const acts = await api("/api/acts");
  $("#reg tbody").innerHTML = acts.map(a => `<tr><td>${fmtDate(a.date)}</td><td>${esc(a.time)}</td>
    <td>${esc(a.address)}</td><td>${esc(a.plate)}</td><td>${esc(a.violation_title)}</td>
    <td>${esc(a.norms)}</td><td>${badge(a.status)}</td><td>${esc(a.inspector_name)}</td>
    <td><a href="/?edit=${a.id}">Изменить</a> · <a href="/api/acts/${a.id}/docx">DOCX</a></td></tr>`).join("")
    || `<tr><td colspan="9">Актов пока нет</td></tr>`;
}

// ---------- Главная ----------
let violations = [], photo = "", currentId = null;
const F = ["plate", "date", "time", "address", "violation", "iname", "ipos"];

function showNorms() {
  const v = violations.find(x => x.code === $("#violation").value);
  $("#norms").innerHTML = v ? `<b>КоАП РБ:</b> ${esc(v.koap)}<br><b>Правила благоустройства г. Уфы:</b> ${esc(v.rules)}` : "Выберите нарушение — нормы подставятся автоматически";
}

function showPhoto(name) {
  photo = name; $("#preview").src = "/uploads/" + name; $("#preview").hidden = !name;
}

// Загрузка файла: отправляем фото на сервер, получаем распознанные (mock) данные
async function onFile(file) {
  const fd = new FormData(); fd.append("file", file);
  $("#msg").textContent = "Обработка фото…";
  try {
    const r = await api("/api/upload", { method: "POST", body: fd });
    showPhoto(r.photo);
    $("#plate").value = r.plate; $("#date").value = r.date; $("#time").value = r.time;
    $("#recog").hidden = false;
    $("#dtsrc").textContent = r.datetime_source ? `Дата и время взяты из ${r.datetime_source}.` : "Дату и время не удалось определить — введите вручную.";
    if (r.gps) {
      $("#gps").innerHTML = `В фото есть геотег: ${r.gps.lat}, ${r.gps.lon} — <a target="_blank" href="https://yandex.ru/maps/?pt=${r.gps.lon},${r.gps.lat}&z=17&l=map">открыть на карте</a>, затем впишите адрес.`;
      if (!$("#address").value) $("#address").placeholder = `Координаты: ${r.gps.lat}, ${r.gps.lon}`;
    } else $("#gps").textContent = "Геотега нет — введите адрес вручную.";
    $("#msg").textContent = "";
  } catch (e) { $("#msg").textContent = e.message; $("#msg").className = "err"; }
}

function payload(status) {
  return { id: currentId, plate: $("#plate").value, date: $("#date").value, time: $("#time").value,
    address: $("#address").value, violation_code: $("#violation").value,
    inspector_name: $("#iname").value, inspector_position: $("#ipos").value, photo, status };
}

// Сохранение акта: черновик или оформленный (для оформленного — скачиваем DOCX)
async function save(status) {
  const msg = $("#msg");
  try {
    const r = await api("/api/acts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(status)) });
    currentId = r.id;
    localStorage.setItem("insp", JSON.stringify({ n: $("#iname").value, p: $("#ipos").value }));
    msg.className = "ok"; msg.textContent = status === "оформлен" ? `Акт № ${r.id} оформлен. Скачивание DOCX…` : `Черновик № ${r.id} сохранён.`;
    $("#editing").textContent = `(акт № ${r.id})`;
    if (status === "оформлен") location.href = `/api/acts/${r.id}/docx`;
    loadHistory();
  } catch (e) { msg.className = "err"; msg.textContent = e.message; }
}

async function loadHistory() {
  const acts = await api("/api/acts?limit=10");
  $("#hist tbody").innerHTML = acts.map(a => `<tr><td>${fmtDate(a.date)}</td><td>${esc(a.time)}</td><td>${esc(a.plate)}</td>
    <td>${esc(a.violation_title)}</td><td>${badge(a.status)}</td>
    <td><a href="/?edit=${a.id}">Изменить</a> · <a href="/api/acts/${a.id}/docx">DOCX</a></td></tr>`).join("")
    || `<tr><td colspan="6">Актов пока нет</td></tr>`;
}

async function loadAct(id) {
  const a = await api("/api/acts/" + id);
  currentId = a.id; $("#plate").value = a.plate; $("#date").value = a.date; $("#time").value = a.time;
  $("#address").value = a.address; $("#violation").value = a.violation_code;
  $("#iname").value = a.inspector_name; $("#ipos").value = a.inspector_position;
  showPhoto(a.photo); showNorms(); $("#editing").textContent = `(редактирование акта № ${a.id})`;
}

async function initMain() {
  violations = await api("/api/violations");
  $("#violation").innerHTML = `<option value="">— выберите нарушение —</option>` + violations.map(v => `<option value="${v.code}">${esc(v.title)}</option>`).join("");
  $("#violation").onchange = showNorms;
  $("#pick").onclick = () => $("#file").click();
  $("#file").onchange = e => e.target.files[0] && onFile(e.target.files[0]);
  $("#plate").oninput = e => e.target.value = e.target.value.toUpperCase();
  $("#draft").onclick = () => save("черновик");
  $("#make").onclick = () => save("оформлен");
  $("#reset").onclick = () => location.href = "/";
  const s = JSON.parse(localStorage.getItem("insp") || "null");  // запоминаем инспектора
  if (s) { $("#iname").value = s.n; $("#ipos").value = s.p; }
  const edit = new URLSearchParams(location.search).get("edit");
  if (edit) await loadAct(edit);
  showNorms(); loadHistory();
}

$("#reg") ? initRegistry() : initMain();
