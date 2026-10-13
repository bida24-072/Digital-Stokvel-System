/* ============================================
   MOTSHELO — Digital Stokvel System
   All data stored locally in the browser.
============================================ */

/* ============================================
   STORAGE
============================================ */
const STORAGE_KEY = "motsheloData";

function loadStore() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return {
            groups: [],
            activeGroupId: null
        };
    }
    try { return JSON.parse(raw); }
    catch { return { groups: [], activeGroupId: null }; }
}

function saveStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

let store = loadStore();

/* ============================================
   HELPERS
============================================ */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatPula(n) {
    return "P" + Number(n).toFixed(2);
}

function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function showToast(msg, type = "success") {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    const icon = type === "error" ? "fa-circle-exclamation" :
                 type === "success" ? "fa-circle-check" : "fa-circle-info";
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
    toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function getGroup(id) {
    return store.groups.find(g => g.id === id);
}

function getActiveGroup() {
    return store.activeGroupId ? getGroup(store.activeGroupId) : null;
}

/* ============================================
   CREATE GROUP
============================================ */
function openCreateGroup() {
    document.getElementById("create-group-modal").classList.add("open");
}

function closeCreateGroup() {
    document.getElementById("create-group-modal").classList.remove("open");
}

function createGroup(e) {
    e.preventDefault();
    const name = document.getElementById("g-name").value.trim();
    const contribution = parseFloat(document.getElementById("g-contribution").value);
    const cycle = document.getElementById("g-cycle").value;
    const monthlyAmount = contribution * cycle.length; // not used but kept

    if (!name || isNaN(contribution) || contribution <= 0) {
        showToast("Fill in all fields", "error");
        return;
    }

    const group = {
        id: uid(),
        name,
        contribution,
        frequency: document.getElementById("g-frequency").value,
        rotation: [],
        members: [],
        payments: [], // { id, memberId, amount, date, method, note }
        createdAt: new Date().toISOString(),
        currentTurnIndex: 0
    };

    store.groups.push(group);
    store.activeGroupId = group.id;
    saveStore();
    closeCreateGroup();
    showToast(`Group "${name}" created`, "success");
    renderAll();
}

/* ============================================
   ADD MEMBER
============================================ */
function openAddMember() {
    if (!getActiveGroup()) {
        showToast("Create or open a group first", "error");
        return;
    }
    document.getElementById("add-member-modal").classList.add("open");
}

function closeAddMember() {
    document.getElementById("add-member-modal").classList.remove("open");
}

function addMember(e) {
    e.preventDefault();
    const group = getActiveGroup();
    if (!group) return;

    const name = document.getElementById("m-name").value.trim();
    const phone = document.getElementById("m-phone").value.trim();
    const position = group.members.length;

    if (!name) {
        showToast("Enter member name", "error");
        return;
    }

    const member = {
        id: uid(),
        name,
        phone,
        joinedAt: new Date().toISOString(),
        position,
        received: false // has received the payout yet
    };

    group.members.push(member);
    group.rotation.push(member.id);
    saveStore();
    closeAddMember();
    showToast(`${name} added to group`, "success");
    renderAll();
}

/* ============================================
   RECORD PAYMENT
============================================ */
function openRecordPayment(memberId) {
    const group = getActiveGroup();
    if (!group) return;
    const member = group.members.find(m => m.id === memberId);
    if (!member) return;

    document.getElementById("payment-member-id").value = memberId;
    document.getElementById("payment-member-name").textContent = member.name;
    document.getElementById("payment-amount").value = group.contribution;
    document.getElementById("payment-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("payment-note").value = "";
    document.getElementById("record-payment-modal").classList.add("open");
}

function closeRecordPayment() {
    document.getElementById("record-payment-modal").classList.remove("open");
}

function recordPayment(e) {
    e.preventDefault();
    const group = getActiveGroup();
    if (!group) return;

    const memberId = document.getElementById("payment-member-id").value;
    const amount = parseFloat(document.getElementById("payment-amount").value);
    const date = document.getElementById("payment-date").value;
    const method = document.getElementById("payment-method").value;
    const note = document.getElementById("payment-note").value.trim();

    if (isNaN(amount) || amount <= 0 || !date) {
        showToast("Enter valid amount and date", "error");
        return;
    }

    group.payments.push({
        id: uid(),
        memberId,
        amount,
        date,
        method,
        note
    });

    saveStore();
    closeRecordPayment();
    showToast(`Payment recorded`, "success");
    renderAll();
}

/* ============================================
   MARK MEMBER AS RECEIVED (rotation)
============================================ */
function markReceived(memberId) {
    const group = getActiveGroup();
    if (!group) return;
    const member = group.members.find(m => m.id === memberId);
    if (!member) return;

    if (member.received) {
        showToast("Already marked as received", "error");
        return;
    }

    if (!confirm(`Mark ${member.name} as having received their payout?`)) return;

    member.received = true;
    member.receivedAt = new Date().toISOString();
    group.currentTurnIndex += 1;
    saveStore();
    showToast(`${member.name} received their payout`, "success");
    renderAll();
}

/* ============================================
   DELETE MEMBER
============================================ */
function deleteMember(memberId) {
    const group = getActiveGroup();
    if (!group) return;
    const member = group.members.find(m => m.id === memberId);
    if (!member) return;

    if (!confirm(`Remove ${member.name} from the group?`)) return;

    group.members = group.members.filter(m => m.id !== memberId);
    group.rotation = group.rotation.filter(id => id !== memberId);
    group.payments = group.payments.filter(p => p.memberId !== memberId);

    saveStore();
    showToast("Member removed", "success");
    renderAll();
}

/* ============================================
   DELETE GROUP
============================================ */
function deleteGroup(groupId) {
    const group = getGroup(groupId);
    if (!group) return;
    if (!confirm(`Delete "${group.name}"? All data will be lost.`)) return;

    store.groups = store.groups.filter(g => g.id !== groupId);
    if (store.activeGroupId === groupId) {
        store.activeGroupId = store.groups[0]?.id || null;
    }
    saveStore();
    showToast("Group deleted", "success");
    renderAll();
}

/* ============================================
   SELECT GROUP
============================================ */
function selectGroup(groupId) {
    store.activeGroupId = groupId;
    saveStore();
    renderAll();
}

function backToGroups() {
    store.activeGroupId = null;
    saveStore();
    renderAll();
}

/* ============================================
   SHARE / EXPORT
============================================ */
function copySummary() {
    const group = getActiveGroup();
    if (!group) return;

    const lines = [];
    lines.push(`MOTSHELO — ${group.name}`);
    lines.push(`Contribution: ${formatPula(group.contribution)} per ${group.frequency}`);
    lines.push(`Members: ${group.members.length}`);
    lines.push(`Total collected: ${formatPula(totalCollected(group))}`);
    lines.push("");
    lines.push("MEMBER PAYMENTS:");
    group.members.forEach(m => {
        const paid = memberPaid(m.id, group);
        const status = paid >= group.contribution ? "PAID" : "PENDING";
        lines.push(`- ${m.name}: ${formatPula(paid)} (${status})`);
    });

    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
        showToast("Summary copied to clipboard", "success");
    }).catch(() => {
        showToast("Copy failed — select manually", "error");
    });
}

function exportCSV() {
    const group = getActiveGroup();
    if (!group) return;

    const rows = [["Member", "Contribution", "Date", "Method", "Note"]];
    group.payments.forEach(p => {
        const member = group.members.find(m => m.id === p.memberId);
        rows.push([
            member ? member.name : "Unknown",
            p.amount.toFixed(2),
            p.date,
            p.method,
            p.note || ""
        ]);
    });

    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `motshelo-${group.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV downloaded", "success");
}

/* ============================================
   COMPUTED
============================================ */
function memberPaid(memberId, group) {
    return group.payments
        .filter(p => p.memberId === memberId)
        .reduce((s, p) => s + p.amount, 0);
}

function totalCollected(group) {
    return group.payments.reduce((s, p) => s + p.amount, 0);
}

function totalPending(group) {
    return group.members.reduce((s, m) => {
        const function renderAll() {
    if (typeof renderLanding === "function" && document.getElementById("groups-grid")) {
        renderLanding();
    }
    if (typeof renderGroupPage === "function" && document.getElementById("group-header")) {
        renderGroupPage();
    }
}
