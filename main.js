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
    try {
        return JSON.parse(raw);
    } catch (e) {
        return { groups: [], activeGroupId: null };
    }
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
    return "P" + Number(n || 0).toFixed(2);
}

function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name) {
    if (!name) return "??";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function showToast(msg, type) {
    type = type || "success";
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    const icon = type === "error" ? "fa-circle-exclamation" :
                 type === "success" ? "fa-circle-check" : "fa-circle-info";
    toast.className = "toast " + type;
    toast.innerHTML = '<i class="fas ' + icon + '"></i> ' + msg;
    toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function() {
        toast.classList.remove("show");
    }, 2400);
}

function getGroup(id) {
    return store.groups.find(function(g) { return g.id === id; });
}

function getActiveGroup() {
    return store.activeGroupId ? getGroup(store.activeGroupId) : null;
}

/* ============================================
   COMPUTED
============================================ */
function memberPaid(memberId, group) {
    return group.payments
        .filter(function(p) { return p.memberId === memberId; })
        .reduce(function(s, p) { return s + p.amount; }, 0);
}

function totalCollected(group) {
    return group.payments.reduce(function(s, p) { return s + p.amount; }, 0);
}

/* ============================================
   CREATE GROUP
============================================ */
function openCreateGroup() {
    const modal = document.getElementById("create-group-modal");
    if (modal) modal.classList.add("open");
}

function closeCreateGroup() {
    const modal = document.getElementById("create-group-modal");
    if (modal) modal.classList.remove("open");
}

function createGroup(e) {
    e.preventDefault();
    const name = document.getElementById("g-name").value.trim();
    const contribution = parseFloat(document.getElementById("g-contribution").value);

    if (!name || isNaN(contribution) || contribution <= 0) {
        showToast("Fill in all fields", "error");
        return;
    }

    const group = {
        id: uid(),
        name: name,
        contribution: contribution,
        frequency: document.getElementById("g-frequency").value,
        rotation: [],
        members: [],
        payments: [],
        createdAt: new Date().toISOString(),
        currentTurnIndex: 0
    };

    store.groups.push(group);
    store.activeGroupId = group.id;
    saveStore();
    closeCreateGroup();
    showToast('Group "' + name + '" created', "success");

    // Redirect to group view
    setTimeout(function() {
        window.location.href = "group.html?id=" + group.id;
    }, 400);
}

/* ============================================
   ADD MEMBER
============================================ */
function openAddMember() {
    if (!getActiveGroup()) {
        showToast("Create or open a group first", "error");
        return;
    }
    const modal = document.getElementById("add-member-modal");
    if (modal) modal.classList.add("open");
}

function closeAddMember() {
    const modal = document.getElementById("add-member-modal");
    if (modal) modal.classList.remove("open");
}

function addMember(e) {
    e.preventDefault();
    const group = getActiveGroup();
    if (!group) return;

    const name = document.getElementById("m-name").value.trim();
    const phoneEl = document.getElementById("m-phone");
    const phone = phoneEl ? phoneEl.value.trim() : "";
    const position = group.members.length;

    if (!name) {
        showToast("Enter member name", "error");
        return;
    }

    const member = {
        id: uid(),
        name: name,
        phone: phone,
        joinedAt: new Date().toISOString(),
        position: position,
        received: false
    };

    group.members.push(member);
    group.rotation.push(member.id);
    saveStore();
    closeAddMember();
    showToast(name + " added to group", "success");

    if (typeof renderGroupPage === "function") {
        renderGroupPage();
    }
}

/* ============================================
   RECORD PAYMENT
============================================ */
function openRecordPayment(memberId) {
    const group = getActiveGroup();
    if (!group) return;

    // If no active group, try to get from URL
    let actualGroup = group;
    if (!actualGroup) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        if (id) actualGroup = getGroup(id);
    }
    if (!actualGroup) return;

    const member = actualGroup.members.find(function(m) { return m.id === memberId; });
    if (!member) return;

    document.getElementById("payment-member-id").value = memberId;
    document.getElementById("payment-member-name").textContent = member.name;
    document.getElementById("payment-amount").value = actualGroup.contribution;
    document.getElementById("payment-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("payment-note").value = "";

    const modal = document.getElementById("record-payment-modal");
    if (modal) modal.classList.add("open");
}

function closeRecordPayment() {
    const modal = document.getElementById("record-payment-modal");
    if (modal) modal.classList.remove("open");
}

function recordPayment(e) {
    e.preventDefault();

    // Get active group, fall back to URL group
    let group = getActiveGroup();
    if (!group) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        if (id) group = getGroup(id);
    }
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
        memberId: memberId,
        amount: amount,
        date: date,
        method: method,
        note: note
    });

    saveStore();
    closeRecordPayment();
    showToast("Payment recorded", "success");

    if (typeof renderGroupPage === "function") {
        renderGroupPage();
    }
}

/* ============================================
   MARK MEMBER AS RECEIVED
============================================ */
function markReceived(memberId) {
    let group = getActiveGroup();
    if (!group) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        if (id) group = getGroup(id);
    }
    if (!group) return;

    const member = group.members.find(function(m) { return m.id === memberId; });
    if (!member) return;

    if (member.received) {
        showToast("Already marked as received", "error");
        return;
    }

    if (!confirm("Mark " + member.name + " as having received their payout?")) return;

    member.received = true;
    member.receivedAt = new Date().toISOString();
    group.currentTurnIndex += 1;
    saveStore();
    showToast(member.name + " received their payout", "success");

    if (typeof renderGroupPage === "function") {
        renderGroupPage();
    }
}

/* ============================================
   DELETE MEMBER
============================================ */
function deleteMember(memberId) {
    let group = getActiveGroup();
    if (!group) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        if (id) group = getGroup(id);
    }
    if (!group) return;

    const member = group.members.find(function(m) { return m.id === memberId; });
    if (!member) return;

    if (!confirm("Remove " + member.name + " from the group?")) return;

    group.members = group.members.filter(function(m) { return m.id !== memberId; });
    group.rotation = group.rotation.filter(function(id) { return id !== memberId; });
    group.payments = group.payments.filter(function(p) { return p.memberId !== memberId; });

    saveStore();
    showToast("Member removed", "success");

    if (typeof renderGroupPage === "function") {
        renderGroupPage();
    }
}

/* ============================================
   DELETE PAYMENT
============================================ */
function deletePayment(paymentId) {
    let group = getActiveGroup();
    if (!group) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        if (id) group = getGroup(id);
    }
    if (!group) return;

    if (!confirm("Delete this payment record?")) return;

    group.payments = group.payments.filter(function(p) { return p.id !== paymentId; });
    saveStore();
    showToast("Payment deleted", "success");

    if (typeof renderGroupPage === "function") {
        renderGroupPage();
    }
}

/* ============================================
   DELETE GROUP
============================================ */
function deleteGroup(groupId) {
    const group = getGroup(groupId);
    if (!group) return;
    if (!confirm('Delete "' + group.name + '"? All data will be lost.')) return;

    store.groups = store.groups.filter(function(g) { return g.id !== groupId; });
    if (store.activeGroupId === groupId) {
        store.activeGroupId = store.groups[0] ? store.groups[0].id : null;
    }
    saveStore();
    showToast("Group deleted", "success");

    if (typeof renderLanding === "function") {
        renderLanding();
    }
}

/* ============================================
   SELECT GROUP
============================================ */
function selectGroup(groupId) {
    store.activeGroupId = groupId;
    saveStore();
}

/* ============================================
   SHARE / EXPORT
============================================ */
function copySummary() {
    let group = getActiveGroup();
    if (!group) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        if (id) group = getGroup(id);
    }
    if (!group) return;

    const lines = [];
    lines.push("MOTSHELO — " + group.name);
    lines.push("Contribution: " + formatPula(group.contribution) + " per " + group.frequency);
    lines.push("Members: " + group.members.length);
    lines.push("Total collected: " + formatPula(totalCollected(group)));
    lines.push("");
    lines.push("MEMBER PAYMENTS:");
    group.members.forEach(function(m) {
        const paid = memberPaid(m.id, group);
        const status = paid >= group.contribution ? "PAID" : "PENDING";
        lines.push("- " + m.name + ": " + formatPula(paid) + " (" + status + ")");
    });

    const text = lines.join("\n");

    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
            showToast("Summary copied to clipboard", "success");
        }).catch(function() {
            showToast("Copy failed", "error");
        });
    } else {
        showToast("Copy not supported on this browser", "error");
    }
}

function exportCSV() {
    let group = getActiveGroup();
    if (!group) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        if (id) group = getGroup(id);
    }
    if (!group) return;

    const rows = [["Member", "Contribution", "Date", "Method", "Note"]];
    group.payments.forEach(function(p) {
        const member = group.members.find(function(m) { return m.id === p.memberId; });
        rows.push([
            member ? member.name : "Unknown",
            p.amount.toFixed(2),
            p.date,
            p.method,
            p.note || ""
        ]);
    });

    const csv = rows.map(function(r) {
        return r.map(function(c) { return '"' + c + '"'; }).join(",");
    }).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "motshelo-" + group.name.replace(/\s+/g, '-').toLowerCase() + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV downloaded", "success");
}

/* ============================================
   RENDER ALL
============================================ */
function renderAll() {
    if (typeof renderLanding === "function" && document.getElementById("groups-grid")) {
        renderLanding();
    }
    if (typeof renderGroupPage === "function" && document.getElementById("group-header")) {
        renderGroupPage();
    }
}

/* ============================================
   INIT
============================================ */
document.addEventListener("DOMContentLoaded", function() {
    // Rendering happens in each page's own script tag
});
