/* Starter templates, loaded on demand from Blanks / Practical sheets (idempotent: fixed ids). */
const it = (id, text, penalty) => (penalty === undefined ? { id, text } : { id, text, penalty: String(penalty) });

export const SEED_BLANKS = [{
  id: 'sample-pa', name: 'Performing Authority', prefix: '', months: 24, credits: 0,
  provider: 'KVET ƏTM / KVET LEC',
  titleAz: 'SƏRİŞTƏLİLİK SERTİFİKATI', titleEn: 'CERTIFICATE OF COMPETENCE',
  qualAz: 'İş İcraçısı', qualEn: 'Performing Authority',
  descAz: '{qual} təlimini uğurla tamamlamışdır. Təlim proqramı AR “Texniki Təhlükəsizlik” haqqında qanununa, ISO 45001 beynəlxalq standartına və ECITB kompetensiya çərçivəsinə uyğun tərtib olunmuşdur',
  descEn: 'Has successfully completed the {qual} training course. The training program is designed in compliance with the Law of the Republic of Azerbaijan On Technical Safety, the ISO 45001 international standard, and the ECITB competency framework.',
  footAz: 'Bu təlim Əməyin Təhlükəsizliyi və Sağlamlıq Komissiyasının Təsdiq edilmiş Təcrübə Kodeksinin (ACOP) tələblərinə uyğundur',
  footEn: 'This training conforms to the requirements of the Health and Safety Commission Approved Code of Practice',
  defaultSheetId: '',
}];

/* The two paper marking sheets, field for field (Word forms "04 Practical Test Marking Sheet OGC" and
   "Appointed Person (Rigging Lifting) Practical sheet"). Item ids are stable, so "Update starter sheets" keeps old results readable. */
const hf = (id, label, type = 'text', auto = '', group = '') => ({ id, label, type, auto, group });
export const SEED_SHEETS = [
  {
    id: 'sample-ogc', name: 'Practical Test Marking Sheet (Overhead Crane)', mode: 'penalty',
    title: 'Practical Test Marking Sheet', subtitle: '(Overhead Crane)',
    rule: { maxPenalty: 40 },
    note: '*Allow 1 adjustment per operation ** The phase ‘fork arms’ includes attachments, if applicable',
    disqNote: '(tick appropriate box and record comments overleaf)',
    headerFields: [
      hf('h1', 'Full Name', 'text', 'candidate', 'Candidate'), hf('h2', 'Organisation', 'text', 'company', 'Candidate'),
      hf('h4', 'Truck Group', 'text', '', 'Truck Type'), hf('h5', 'Capacity (SWL)', 'text', '', 'Truck Type'), hf('h6', 'Load Centre', 'text', '', 'Truck Type'),
      hf('h7', 'Height', 'text', '', 'Truck Type'), hf('h8', 'Height used on test', 'text', '', 'Truck Type'), hf('h9', 'Attachments', 'text', '', 'Truck Type'),
      hf('h10', 'a. Set time', 'number', '', 'Time'), hf('h11', 'b. Start time', 'time', '', 'Time'), hf('h12', 'c. Finish time', 'time', '', 'Time'),
      hf('h13', 'd. Duration', 'duration', '', 'Time'), hf('h14', 'Excess time (d minus a)', 'excess', '', 'Time')],
    timeRate: 1,
    timePenalty: true,
    disq: ['Exceed Max. Time', 'Unsafe Stacking', 'Violent Collision', 'Operating Dangerously', 'Overloads Crane'].map((text, i) => ({ id: 'd' + (i + 1), text })),
    sections: [
      { id: 's1', title: 'Operator Safety', items: [it('i1', 'Fails to wear safety equipment W/A', 5), it('i2', 'Mounts/dismounts incorrectly', 3), it('i3', 'Fails to maintain a safe operating position', 5)] },
      { id: 's2', title: 'Operator Observation', items: [it('i4', 'Fails to look in direction of travel', 5), it('i5', 'Fails to check all round', 5), it('i6', 'Fails to observe/obey slinger’s signals', 5), it('i7', 'Misinterprets slinger’s signals', 3), it('i8', 'Rides foot brake', 5)] },
      { id: 's3', title: 'Using Machine Controls', items: [it('i9', 'Selects wrong hydraulic control', 3), it('i10', 'Excessive use of hydraulic controls', 3), it('i11', 'Rough use of hydraulic controls', '3-5'), it('i12', 'Fails to hold steering wheel/assistors', 3), it('i13', 'Fork arms/load too high when travelling', 5), it('i14', 'Fork arms/load too low when travelling', 1)] },
      { id: 's4', title: 'Lifting/Lowering/Transporting', items: [it('i15', 'Fails to “spot” hook/attachment', '3-5'), it('i16', 'Engages/disengages attachment incorrectly', '3-5'), it('i17', 'Fails to take a test lift', 3)] },
      { id: 's5', title: 'Lifting/Lowering/Transporting Continued', col2: true, items: [it('i18', 'Imposes shock load', 5), it('i19', 'Allows the load to swing excessively', 5), it('i20', 'Fails to correct load swing', 5), it('i21', 'Travels with load too high/low', '3-5'), it('i22', 'Traverses incorrectly', 3), it('i23', 'Long travel incorrectly', 3), it('i24', 'Fails to check landing area is clear', 3), it('i25', 'Positioning load incorrectly', 3), it('i26', 'Load incorrectly stacked', 3), it('i27', 'Travel with hook incorrectly positioned', 3), it('i28', 'Touches course', 3), it('i29', 'Allows load to hit obstruction', 5)] },
      { id: 's6', title: 'Parking', items: [it('i30', 'Fails to park crane in correct position', 3), it('i31', 'Leaves hook incorrectly positioned', 3), it('i32', 'Fails to switch off lights', 3), it('i33', 'Fails to switch off crane', 3), it('i34', 'Fails to isolate machine', 3)] },
    ],
  },
  {
    id: 'sample-ap', name: 'Practical Test Marking Sheet – Appointed Person (Rigging & Lifting)', mode: 'rating',
    title: 'Practical Test Marking Sheet', subtitle: 'Appointed Person (Rigging Lifting)',
    rule: { minAvg: 3, failBelow: 2 },
    note: 'A rating of 1 (Unsafe) on any duty fails the candidate; the average of the rated duties must reach 3 (Satisfactory).',
    // left column: Delegate Name / Position / Location, right column: Company / Location / Date (as on the form)
    headerFields: [hf('h1', 'Delegate Name', 'text', 'candidate'), hf('h3', 'Position'), hf('h4', 'Location', 'text', 'location'), hf('h2', 'Company', 'text', 'company'), hf('h6', 'Location'), hf('h5', 'Date', 'text', 'date')],
    timePenalty: false, disq: [],
    sections: [
      { id: 's1', title: 'Appointed Person Duties', items: ['Carry out risk assessment & toolbox talk (TBT)', 'Identify hazards and instigate control measures', 'Determine the weight of the load', 'Identify approximate Centre of Gravity (C.o.G.)', 'Select suitable lifting equipment', 'Control and direct slingers/signallers', 'Direct the lifting operation', 'Prepare and control lay-down area'].map((t, i) => it('i' + (i + 1), t)) },
      { id: 's2', title: 'General Performance', items: ['Secure / barrier off immediate lifting area', 'Select appropriate lifting gear for the job', 'Inspect lifting equipment before use', 'Safely rig / install equipment', 'Rig the load correctly (sling modes & angles)', 'Attach accessories correctly to crane hook', 'Demonstrate practical skill & knowledge'].map((t, i) => it('i' + (i + 9), t)) },
    ],
  },
];
