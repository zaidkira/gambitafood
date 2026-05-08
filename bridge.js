const { io } = require('socket.io-client');
const net = require('net');
const iconv = require('iconv-lite');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

const CLOUD_URL = process.env.CLOUD_URL || "https://gambitafood.onrender.com";
const BRIDGE_NAME = process.env.BRIDGE_NAME || "Remote-Bridge-PC";

console.log(`
=========================================
🚀 GOMBITA FOOD - STANDALONE BRIDGE
=========================================
Connecting to: ${CLOUD_URL}
Bridge Name:   ${BRIDGE_NAME}
Status:        Initializing...
=========================================
`);

// --- TRANSLATOR LOGIC ---
const translationMap = {
    "طاولة": "Table", "تذكرة": "Ticket", "نادل": "Serveur", "المجموع": "Total", "سعر": "Prix",
    "الكمية": "Qte", "توصيل": "Delivery", "شوارما": "Shawarma", "شاورما": "Shawarma",
    "سندويتش": "Sandwich", "ساندويتش": "Sandwich", "صحن": "Plat", "ميكس": "Mix",
    "دجاج": "Poulet", "لحم": "Viande", "مرقاز": "Merguez", "كبدة": "Foie", "إسكالوب": "Escalope",
    "هامبورغ": "Hamburger", "برغر": "Burger", "برغار": "Burger", "بيتزا": "Pizza", "تاكوس": "Tacos",
    "صلصة": "Sauce", "ثوم": "Ail", "حار": "Piquant", "هريسة": "Harissa", "مايونيز": "Mayonnaise",
    "خبز": "Pain", "مطلوع": "Matlouh", "بانيني": "Panini",
    "بدون": "Sans", "نقص": "Moins", "زيادة": "Plus", "ملح": "Sel", "بصل": "Oignon",
    "سلطة": "Salade", "طماطم": "Tomate", "فرماج": "Fromage", "جبن": "Fromage",
    "بيض": "Oeuf", "بطاطا": "Frites", "فريت": "Frites", "كاتشب": "Ketchup",
    "مايو": "Mayo", "مايونيز": "Mayonnaise", "ثومية": "Ail", "كريمة": "Creme",
    "ماء": "Eau", "عصير": "Jus", "غازية": "Gazeuse", "مشروب": "Boisson"
};

function translateText(text) {
    if (!text) return "";
    let translated = text;
    if (translationMap[text]) return translationMap[text];
    Object.keys(translationMap).forEach(arabic => {
        const regex = new RegExp(arabic, 'g');
        translated = translated.replace(regex, translationMap[arabic]);
    });
    // Do NOT strip Arabic here, allow the line() function to handle it
    return translated.replace(/\s+/g, ' ').trim();
}

// --- PRINTING LOGIC ---
async function executeDirectPrint(printer, data) {
    return new Promise((resolve, reject) => {
        console.log(`🖨️  Printing: ${data.title || 'Order'} -> ${printer.name} (${printer.ip})`);
        const client = new net.Socket();
        client.setTimeout(5000);

        client.connect(printer.port || 9100, printer.ip, () => {
            try {
                // Auto-Drawer Command if requested
                if (data.openDrawer) {
                    client.write('\x1B\x70\x00\x19\xFA');
                    if (data.onlyDrawer) {
                        client.end();
                        resolve();
                        return;
                    }
                }

                // Initialize & Set French Page
                client.write('\x1B\x40\x1B\x74\x02');

                const isArabic = (text) => /[\u0600-\u06FF]/.test(text);

                const writeText = (t = "", addNewLine = true) => {
                    let textToPrint = translateText(t);
                    if (addNewLine) textToPrint += "\n";

                    if (isArabic(textToPrint)) {
                        // Switch to Arabic Code Page (PC864)
                        client.write('\x1B\x74\x16');
                        client.write(iconv.encode(textToPrint, 'ibm864'));
                        // Switch back to PC850
                        client.write('\x1B\x74\x02');
                    } else {
                        client.write(iconv.encode(textToPrint, 'cp850'));
                    }
                };

                const line = (t = "") => writeText(t, true);

                const center = () => client.write('\x1B\x61\x01');
                const left = () => client.write('\x1B\x61\x00');
                const bold = (on) => client.write(on ? '\x1B\x45\x01' : '\x1B\x45\x00');
                const big = (on) => client.write(on ? '\x1D\x21\x11' : '\x1D\x21\x00');
                const inverse = (on) => client.write(on ? '\x1D\x42\x01' : '\x1D\x42\x00');

                const isK = !data.isInvoice;

                center();
                if (!isK) {
                    client.write('\x1C\x70\x01\x00');
                    big(true); line("GOMBITA FOOD"); big(false);
                    line("--------------------------------");
                    bold(true); line(data.title || "TICKET"); bold(false);
                } else {
                    bold(true); line(data.title || "CUISINE"); bold(false);
                }

                left();

                const isDelivery = (data.tableId && (data.tableId.toString().includes('توصيل') || data.tableId.toString().toLowerCase().includes('delivery'))) || data.type === 'delivery';

                if (isDelivery) {
                    inverse(true); big(true); center();
                    line(`>>> ${data.tableId || 'توصيل'} <<<`);
                    left(); big(false); inverse(false);
                } else {
                    line(`Table: ${data.tableId || 'Emporter'}`);
                }

                line(`No: ${data.ticketNumber || '-'}`);
                line(`Heure: ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
                if (data.clientName || data.serveur) {
                    line(`Serveur/Client: ${data.clientName || data.serveur}`);
                }
                line("--------------------------------");

                data.items.forEach(i => {
                    if (isK) big(true);

                    const qtyStr = `${i.quantity}x `;
                    const nameStr = i.name + (i.breadType ? ` ${i.breadType}` : "");

                    if (!isK && i.price) {
                        bold(true); writeText(qtyStr, false); bold(false);
                        writeText(nameStr, false);
                        line(` (${i.price} DZ)`);
                    } else {
                        bold(true); writeText(qtyStr, false); bold(false);
                        line(nameStr);
                    }

                    if (isK) big(false);

                    if (i.selectedAddons?.length) {
                        i.selectedAddons.forEach(addon => {
                            line(`  + ${addon}`);
                        });
                    }

                    if (i.notes && i.notes.trim() !== "") {
                        if (isK) {
                            inverse(true); bold(true);
                            line(`  ** NOTE: ${i.notes}`);
                            bold(false); inverse(false);
                        } else {
                            bold(true);
                            line(`  ** NOTE: ${i.notes}`);
                            bold(false);
                        }
                    }
                });

                if (data.total) {
                    line("--------------------------------");
                    bold(true); big(true); line(`TOTAL: ${data.total} DZ`); big(false); bold(false);
                }

                // Print common Order Notes (KITCHEN ONLY)
                if (data.notes && data.notes.trim() !== "" && isK) {
                    line("================================");
                    inverse(true); bold(true); big(true);
                    line("NOTE COMMANDE");
                    big(false); inverse(false);
                    line(data.notes);
                    bold(false);
                    line("================================");
                }

                line("--------------------------------");
                if (!isK) {
                    center();
                    bold(true); line("DAR DARKOM"); bold(false);
                    line("--------------------------------");
                    line("FB: Gombita Food");
                    line("Insta: gombita_food");
                    line("TikTok: gombita.food");
                }

                line("\n\n\n\x1D\x56\x41\x00"); // Cut
                client.end();
                resolve();
            } catch (err) { client.destroy(); reject(err); }
        });

        client.on('error', (err) => { client.destroy(); reject(err); });
        client.on('timeout', () => { client.destroy(); reject(new Error('Printer Timeout')); });
    });
}

// --- SOCKET CONNECTION ---
const socket = io(CLOUD_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    transports: ['polling', 'websocket'],
    rejectUnauthorized: false
});

socket.on('connect', () => {
    console.log("✅ Connected to Cloud Server.");
    socket.emit('join-room', 'staff');
});

socket.on('connect_error', (err) => {
    console.log(`⚠️ Connection Issue: ${err.message}`);
});

socket.on('remote-print', async (payload) => {
    const { printer, data } = payload;
    try {
        await executeDirectPrint(printer, data);
        console.log(`✅ Print successful.`);
    } catch (err) {
        console.error(`❌ Print failed:`, err.message);
    }
});

socket.on('disconnect', () => {
    console.log("❌ Disconnected from server. Retrying...");
});

// Keep-alive heartbeat
setInterval(() => {
    if (socket.connected) {
        process.stdout.write(".");
    }
}, 30000);
