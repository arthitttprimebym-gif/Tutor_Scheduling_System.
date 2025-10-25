// ในไฟล์ script.js:

// *** แก้ไข: ต้องเพิ่ม /exec ต่อท้าย URL ***
const BASE_API_URL = 'https://script.google.com/macros/s/AKfycbwe8Ztc3cmDuQLD-va6PIhPl18xaOo4CaF8m8QNmc9_KDeiDHxamP86nV5rWHyrXKAlAA/exec'; 
//                                                                                                                    ^ เพิ่มส่วนนี้

// แก้ไข: พารามิเตอร์ sheet ต้องเป็นตัวพิมพ์เล็ก 'availability' ตามโค้ด Apps Script
const AVAILABILITY_API_URL = `${BASE_API_URL}?sheet=availability`; 

// URL สำหรับดึง Student Schedule
const STUDENT_SCHEDULE_API_URL = `${BASE_API_URL}?sheet=students`;

// ข้อมูลติวเตอร์
const TUTORS = ['Minnie', 'Leon', 'Mo', 'Mickey', 'Bell', 'Winny', 'Lin'];

// ช่วงเวลาสอน (11:00-20:00, ทุก 30 นาที)
const TIME_SLOTS = [
    '11:00 - 11:30', '11:30 - 12:00', '12:00 - 12:30', '12:30 - 13:00',
    '13:00 - 13:30', '13:30 - 14:00', '14:00 - 14:30', '14:30 - 15:00',
    '15:00 - 15:30', '15:30 - 16:00', '16:00 - 16:30', '16:30 - 17:00',
    '17:00 - 17:30', '17:30 - 18:00', '18:00 - 18:30', '18:30 - 19:00',
    '19:00 - 19:30', '19:30 - 20:00'
];

let currentMonth = new Date(2025, 10, 1); // เริ่มที่ 1 พ.ย. 2025
let tutorAvailabilityData = {}; // เก็บข้อมูลความว่างที่ดึงมาจาก Apps Script
let studentSchedule = {}; // เก็บข้อมูลตารางเรียนนักเรียนที่ดึงมา

// ฟังก์ชันหลักในการโหลดข้อมูลทั้งหมด
async function loadAllData() {
    // โหลดข้อมูลทั้งสองชุดพร้อมกัน
    const [availabilitySuccess, scheduleSuccess] = await Promise.all([
        fetchTutorAvailability(),
        fetchStudentSchedule()
    ]);
    
    if (availabilitySuccess && scheduleSuccess) {
        renderSchedule(currentMonth); // เมื่อได้ข้อมูลครบแล้วค่อยแสดงตาราง
    } else {
        document.getElementById('scheduleBody').innerHTML = '<tr><td colspan="32" style="color:red; text-align:center; padding: 20px;">ไม่สามารถโหลดข้อมูลบางส่วนหรือทั้งหมดได้ โปรดตรวจสอบ Console และการตั้งค่า Apps Script</td></tr>';
    }
}

/**
 * 1. ดึงข้อมูลความว่างของติวเตอร์
 */
async function fetchTutorAvailability() {
    try {
        const response = await fetch(AVAILABILITY_API_URL);
        const sheetData = await response.json();
        if (sheetData.error) throw new Error(sheetData.error);
        tutorAvailabilityData = processAvailabilityData(sheetData);
        return true;
    } catch (error) {
        console.error("Error fetching availability:", error);
        return false;
    }
}

/**
 * 2. ดึงข้อมูลตารางเรียนของนักเรียน
 */
async function fetchStudentSchedule() {
    try {
        const response = await fetch(STUDENT_SCHEDULE_API_URL);
        const sheetData = await response.json();
        if (sheetData.error) throw new Error(sheetData.error);
        studentSchedule = processStudentScheduleData(sheetData); 
        return true;
    } catch (error) {
        console.error("Error fetching student schedule:", error);
        return false;
    }
}

/**
 * 3. ฟังก์ชันแปลงข้อมูลความว่างติวเตอร์ (จาก Array เป็น Object by Date/Time)
 */
function processAvailabilityData(data) {
    const processed = {};
    data.forEach(row => {
        const dateKey = row.Date; 
        if (!dateKey || row.Status === 'Not Available') return; 

        if (!processed[dateKey]) {
            processed[dateKey] = {};
        }

        const tutor = row.Tutor;
        // Slots จะเป็น String ที่มีหลายช่องเวลาคั่นด้วย comma เช่น "11:00, 11:30"
        const slots = row.Slots ? row.Slots.split(',').map(s => s.trim().substring(0, 5)) : []; 

        if (slots.length > 0) {
            slots.forEach(timeKey => {
                if (!processed[dateKey][timeKey]) {
                    processed[dateKey][timeKey] = [];
                }
                processed[dateKey][timeKey].push(tutor);
            });
        }
    });
    return processed;
}

/**
 * 4. ฟังก์ชันแปลงข้อมูลตารางเรียนนักเรียน (จาก Array เป็น Object by Key)
 */
function processStudentScheduleData(data) {
    const processed = {};
    data.forEach(item => {
        // Key: YYYY-MM-DD-HH:mm
        const key = `${item.date}-${item.time}`; 
        processed[key] = {
            tutor: item.tutor,
            course: item.course, 
            location: item.location, 
            type: item.location ? (item.location.toLowerCase().includes('online') ? 'online' : 'onsite') : 'N/A',
            student: item.student,
            change_count: item.change_count
        };
    });
    return processed;
}

/**
 * 5. ฟังก์ชันสร้างหัวตาราง (วันที่) และเนื้อหาตาราง (ช่วงเวลา)
 */
function renderSchedule(date) {
    const tableBody = document.getElementById('scheduleBody');
    const dayHeaders = document.getElementById('dayHeaders');
    const currentMonthYear = document.getElementById('currentMonthYear');
    tableBody.innerHTML = '';
    dayHeaders.innerHTML = '<th class="time-header">เวลา</th>';

    const year = date.getFullYear();
    const month = date.getMonth();
    currentMonthYear.textContent = `${date.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}`;
    
    // สร้าง Array ของวันที่ในเดือนนั้นๆ
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dates = [];
    for (let i = 1; i <= daysInMonth; i++) {
        const currentDate = new Date(year, month, i);
        // กรองเฉพาะวันที่อยู่ในเดือนปัจจุบัน
        if (currentDate.getMonth() === month) {
            dates.push(currentDate);
            const dayName = currentDate.toLocaleString('th-TH', { weekday: 'short' });
            const dayOfMonth = currentDate.getDate();
            dayHeaders.innerHTML += `<th>${dayName} ${dayOfMonth}</th>`; // ลบ month short ออกเพื่อให้ header สั้นลง
        }
    }

    // สร้างเนื้อหาตาราง (ช่วงเวลา)
    TIME_SLOTS.forEach(slot => {
        const row = tableBody.insertRow();
        const timeCell = row.insertCell();
        timeCell.textContent = slot.substring(0, 5); 

        dates.forEach(day => {
            const cell = row.insertCell();
            const dateKey = day.toISOString().split('T')[0];
            const timeKey = slot.substring(0, 5);
            const scheduleKey = `${dateKey}-${timeKey}`;

            // A. ตรวจสอบข้อมูลตารางสอนนักเรียน (Priority 1: คลาสที่ถูกจองแล้ว)
            if (studentSchedule[scheduleKey]) {
                const classData = studentSchedule[scheduleKey];
                cell.classList.add('class-slot', `tutor-${classData.tutor}`);
                cell.innerHTML = `
                    <span style="color:#0056b3; font-weight:bold;">${classData.tutor}</span>: ${classData.course}
                    <br>(${classData.type})
                `;
            } 
            // B. ตรวจสอบข้อมูลความว่างของติวเตอร์ (Priority 2: ว่างแต่ยังไม่มีคลาส)
            else if (tutorAvailabilityData[dateKey] && tutorAvailabilityData[dateKey][timeKey]) {
                const availableTutors = tutorAvailabilityData[dateKey][timeKey];
                cell.classList.add('available-slot');
                cell.style.backgroundColor = '#e6ffed'; 
                cell.title = availableTutors.join(', '); 
                cell.innerHTML = `<span style="color:#28a745;">ว่าง (${availableTutors.length})</span>`;
            } 
            // C. ช่องที่ไม่ว่าง
            else {
                cell.classList.add('unavailable-slot');
                cell.style.backgroundColor = '#f8f9fa'; 
                cell.textContent = '';
            }
        });
    });

    renderSummary();
}

/**
 * 6. ฟังก์ชันคำนวณและแสดงผลรวมชั่วโมงสอน
 */
function renderSummary() {
    const tutorHours = {}; 
    const summaryDiv = document.getElementById('tutorSummary');
    summaryDiv.innerHTML = '';

    // นับชั่วโมงจากตารางเรียนนักเรียน (แต่ละคลาสที่ดึงมาคือ 0.5 ชั่วโมง)
    Object.values(studentSchedule).forEach(classData => {
        const tutor = classData.tutor;
        tutorHours[tutor] = (tutorHours[tutor] || 0) + 0.5; 
    });

    // แสดงผล
    TUTORS.forEach(tutor => {
        const hours = tutorHours[tutor] || 0;
        const summaryItem = document.createElement('div');
        summaryItem.innerHTML = `<span style="font-weight:bold;">${tutor}:</span> ${hours} ชั่วโมง`;
        summaryDiv.appendChild(summaryItem);
    });
}

// *** Event Listeners สำหรับปุ่มเปลี่ยนเดือน ***
document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    const minDate = new Date(2025, 10, 1); 
    if (currentMonth.getTime() < minDate.getTime()) {
        currentMonth = minDate;
        alert("ตารางเริ่มต้นที่เดือนพฤศจิกายน 2025");
        return;
    }
    renderSchedule(currentMonth);
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    const maxDate = new Date(2026, 11, 1); 
    if (currentMonth.getTime() > maxDate.getTime()) {
        currentMonth.setMonth(currentMonth.getMonth() - 1); // ย้อนกลับ 1 เดือน
        alert("ตารางสิ้นสุดที่เดือนธันวาคม 2026");
        return;
    }
    renderSchedule(currentMonth);
});

// **เริ่มต้นระบบ: เรียกฟังก์ชันโหลดข้อมูลเมื่อเปิดหน้าเว็บ**
loadAllData();