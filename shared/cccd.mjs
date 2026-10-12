// Parses the QR code printed on Vietnamese chip ID cards (CCCD):
//   "<12-digit id>|<old 9-digit CMND or empty>|<full name>|<ddmmyyyy dob>|<Nam|Nữ>|<address>|<ddmmyyyy issue date>"
// Shared so the browser (camera / scanner gun) and the server use the same rules.
const ddmmyyyy = (s) => (/^\d{8}$/.test(s ?? '') ? `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}` : null);

export function parseCccd(raw) {
  const parts = String(raw ?? '').trim().split('|');
  if (parts.length < 6 || !/^\d{12}$/.test(parts[0])) return null;
  const gender = parts[4].normalize('NFC').toLowerCase();
  return {
    id_number: parts[0],
    old_id: parts[1] || '',
    name: parts[2].trim(),
    dob: ddmmyyyy(parts[3]),
    gender: gender === 'nam' ? 'male' : gender === 'nữ' || gender === 'nu' ? 'female' : '',
    address: parts[5].trim(),
    issued: ddmmyyyy(parts[6]),
  };
}
