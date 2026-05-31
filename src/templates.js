// Canonical templates for university checklists.
// Each item: { title (EN), title_th (TH), description }.

export const TEMPLATES = {
  kmutnb: {
    name: 'KMUTNB · มจพ.',
    description: 'Standard 12-item checklist for the KMUTNB student loan renewal (กยศ./กรอ.).',
    items: [
      {
        title: 'DSL loan confirmation form (printable from 21 Jun)',
        title_th: 'แบบยืนยันการเบิกเงินกู้ยืม จากระบบ DSL (ทำได้ตั้งแต่ 21 มิ.ย. เป็นต้นไป)',
        description: '2 แผ่น · 2 sheets',
      },
      {
        title: 'Copy of borrower’s ID card',
        title_th: 'สำเนาบัตรประชาชนผู้กู้ยืม',
        description: '2 แผ่น · 2 sheets',
      },
      {
        title: 'Copy of guardian’s ID card',
        title_th: 'สำเนาบัตรประชาชนผู้ปกครอง',
        description: '2 แผ่น · 2 sheets',
      },
      {
        title: 'Death certificate or guardian-separation document set',
        title_th: '[สำเนาใบมรณบัตรฯ] + [หนังสือรับรองการแยกกันอยู่กับมารดา และสำเนาบัตรข้าราชการของผู้รับรอง]',
        description: '1 ชุด · 1 set (เฉพาะกรณีที่เกี่ยวข้อง)',
      },
      {
        title: 'Guardian income certificate or pay slip',
        title_th: '[หนังสือรับรองเงินเดือนของผู้ปกครอง] หรือ [สลิปเงินเดือนของผู้ปกครอง]',
        description: '1 ชุด · 1 set',
      },
      {
        title: 'Transcript of all semesters (reg.kmutnb.ac.th) through 2/2568',
        title_th: 'ผลการเรียนทุกเทอม ในระบบ reg.kmutnb.ac.th ถึง 2/2568',
        description: '1 ชุด · 1 set',
      },
      {
        title: 'Registration record for 1/2569 (reg.kmutnb.ac.th)',
        title_th: 'เอกสารแสดงผลการลงทะเบียน 1/2569 ในระบบ reg.kmutnb.ac.th',
        description: '1 ชุด · 1 set',
      },
      {
        title: 'Tuition / fund expense record for 1/2569 (reg.kmutnb.ac.th)',
        title_th: 'เอกสารแสดงค่าใช้จ่ายทุน 1/2569 ในระบบ reg.kmutnb.ac.th (ในกรณีกองทุนต้องส่ง)',
        description: '1 ชุด · 1 set',
      },
      {
        title: 'Accident-insurance receipt + correction slip if any',
        title_th: '[สำเนาใบเสร็จรับเงินค่าประกันอุบัติเหตุ] + [ใบแก้ไขค่าส่วนต่าง (ถ้ามี)]',
        description: '1 ชุด · 1 set',
      },
      {
        title: 'Volunteer record — at least 36 hours',
        title_th: 'บันทึกกรรมจิตอาสาไม่น้อยกว่า 36 ชั่วโมง',
        description: '1 ชุด · 1 set — see the Volunteer page in this app.',
      },
      {
        title: 'Exam-code registration form 1/2569 (sa.op.kmutnb.ac.th)',
        title_th: 'ใบลงทะเบียนรหัสสอบสาร เทอม 1/2569 (https://sa.op.kmutnb.ac.th)',
        description: '1 แผ่น · 1 sheet',
      },
      {
        title: 'Checklist cover sheet (1/2569)',
        title_th: 'ใบเช็คลิสต์เอกสาร (Check list 1/2569) จากมหาวิทยาลัย',
        description: 'แนบเป็นใบหน้า · attach as the first page',
      },
    ],
  },
};
