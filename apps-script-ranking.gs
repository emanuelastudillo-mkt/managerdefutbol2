/*
  Fútbol Manager · Ranking Online V3.17
  Apps Script para pegar en https://script.google.com/

  Pasos:
  1. Crear un Google Sheet vacío.
  2. Abrir Extensiones > Apps Script.
  3. Pegar este archivo.
  4. Cambiar SPREADSHEET_ID por el ID de tu hoja.
  5. Implementar como Web App:
     - Ejecutar como: yo
     - Acceso: cualquier persona
  6. Copiar la URL /exec y pegarla en config.js o en la pantalla Ranking Online.
*/

const SPREADSHEET_ID = '1ADONE8c3AOAhmrF0MKKRC9oJsGOJJG-pZaqm-NM5OeI';
const SHEET_NAME = 'Ranking';
const RANKING_TOKEN = ''; // opcional. Si usás token, copiá el mismo valor en config.js > ranking.token.

const HEADERS = [
  'Fecha de envío',
  'Nombre del manager',
  'Club usado',
  'Temporada',
  'División',
  'Posición final',
  'Puntos',
  'Partidos ganados',
  'Partidos empatados',
  'Partidos perdidos',
  'Goles a favor',
  'Goles en contra',
  'Diferencia de gol',
  'Presupuesto inicial',
  'Presupuesto final',
  'Variación de presupuesto',
  'Cantidad de títulos',
  'Puntaje manager',
  'Código de partida',
  'Versión'
];

function doGet(e){
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || 'list';
  if(action === 'list'){
    const limit = Math.max(1, Math.min(Number(params.limit || 100), 500));
    const rows = readRankingRows_(limit);
    return output_(params, { ok:true, rows });
  }
  return output_(params, { ok:false, error:'Acción GET no reconocida.' });
}

function doPost(e){
  const params = e && e.parameter ? e.parameter : {};
  if(RANKING_TOKEN && params.token !== RANKING_TOKEN){
    return output_(params, { ok:false, error:'Token inválido.' });
  }
  const payload = parsePayload_(params.payload);
  const validation = validatePayload_(payload);
  if(validation){
    return output_(params, { ok:false, error:validation });
  }
  appendRankingRow_(payload);
  return output_(params, { ok:true });
}

function parsePayload_(raw){
  try{ return JSON.parse(raw || '{}'); }
  catch(_){ return {}; }
}

function validatePayload_(payload){
  if(!payload.managerName) return 'Falta nombre del manager.';
  if(!payload.club) return 'Falta club.';
  if(!payload.saveCode) return 'Falta código de partida.';
  if(!payload.season) return 'Falta temporada.';
  if(payload.position === undefined || payload.position === null) return 'Falta posición final.';
  return '';
}

function sheet_(){
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if(!sheet) sheet = ss.insertSheet(SHEET_NAME);
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeader = current.every(value => !value) || current[0] !== HEADERS[0];
  if(needsHeader){
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendRankingRow_(payload){
  const sheet = sheet_();
  const row = [
    payload.submittedAt || new Date().toISOString(),
    payload.managerName || '',
    payload.club || '',
    Number(payload.season || 0),
    payload.division || '',
    Number(payload.position || 0),
    Number(payload.points || 0),
    Number(payload.won || 0),
    Number(payload.drawn || 0),
    Number(payload.lost || 0),
    Number(payload.goalsFor || 0),
    Number(payload.goalsAgainst || 0),
    Number(payload.goalDifference || 0),
    Number(payload.initialBudget || 0),
    Number(payload.finalBudget || 0),
    Number(payload.budgetVariation || 0),
    Number(payload.titles || 0),
    Number(payload.managerScore || 0),
    payload.saveCode || '',
    payload.version || ''
  ];
  const existingRow = findExistingSubmissionRow_(sheet, payload.saveCode, payload.season);
  if(existingRow){
    sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([row]);
  }else{
    sheet.appendRow(row);
  }
}

function findExistingSubmissionRow_(sheet, saveCode, season){
  if(!saveCode || !season) return 0;
  const lastRow = sheet.getLastRow();
  if(lastRow < 2) return 0;
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const codeIndex = HEADERS.indexOf('Código de partida');
  const seasonIndex = HEADERS.indexOf('Temporada');
  for(let i = 0; i < values.length; i++){
    if(String(values[i][codeIndex]) === String(saveCode) && Number(values[i][seasonIndex]) === Number(season)){
      return i + 2;
    }
  }
  return 0;
}

function readRankingRows_(limit){
  const sheet = sheet_();
  const values = sheet.getDataRange().getValues();
  if(values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row.some(value => value !== ''))
    .map(row => {
      const item = {};
      headers.forEach((header, index) => item[header] = row[index]);
      return item;
    })
    .sort((a,b) => Number(b['Puntaje manager'] || 0) - Number(a['Puntaje manager'] || 0))
    .slice(0, limit);
}

function output_(params, data){
  const text = JSON.stringify(data);
  if(params && params.callback){
    return ContentService
      .createTextOutput(String(params.callback).replace(/[^a-zA-Z0-9_.$]/g, '') + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
