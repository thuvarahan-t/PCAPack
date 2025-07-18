function doGet(e) {
  return ContentService.createTextOutput('Web App is running!').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let response = { success: false, message: 'Unknown action' };

    if (action === 'addPackage') {
      handleAddPackage(data.packageData);
      response = { success: true, message: 'Package added successfully' };
    } else if (action === 'assignPackage') {
      handleAssignStudent(data.studentData);
      response = { success: true, message: 'Student package assigned successfully' };
    } else if (action === 'getData') {
      const dataResult = handleGetData();
      response = { success: true, data: dataResult, message: 'Data fetched successfully' };
    } else if (action === 'searchStudent') {
      const records = handleSearchStudent(data.registrationId);
      response = { success: true, data: records, message: 'Student records fetched successfully' };
    } else if (action === 'updateStudent') {
      handleUpdateStudent(data.updatedData);
      response = { success: true, message: 'Student data updated successfully' };
    } else if (action === 'deleteStudent') {
      handleDeleteStudent(data.registrationId);
      response = { success: true, message: 'Student record deleted successfully' };
    } else if (action === 'searchByDate') {
      const records = handleSearchByDate(data.date);
      response = { success: true, data: records, message: 'Records for the date fetched successfully' };
    } else if (action === 'getPackageCountReport') {
      const reportData = handleGetPackageCountReport(data.startDate, data.endDate);
      response = { success: true, data: reportData, message: 'Package count report generated successfully' };
    } else if (action === 'login') {
      const { username, password } = data;
      const isAuthenticated = handleLogin(username, password);
      response = { success: isAuthenticated, message: isAuthenticated ? 'Login successful' : 'Invalid credentials' };
    } else if (action === 'getAdminReport') {
      const reportData = handleGetAdminReport(data.adminName, data.startDate, data.endDate);
      response = { success: true, data: reportData, message: 'Admin report generated successfully' };
    } else {
      response = { success: false, message: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Server error: ' + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetByName(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error(`Sheet "${name}" not found.`);
  }
  return sheet;
}

function handleAddPackage(packageData) {
  if (!packageData || !packageData.id || !packageData.name) {
    throw new Error('Invalid package data: ID and Name are required.');
  }
  const sheet = getSheetByName('Packages');
  sheet.appendRow([String(packageData.id), packageData.name]);
}

function handleAssignStudent(studentData) {
  if (!studentData || !studentData.registrationId || !studentData.packageName || !studentData.duration || !studentData.batch || !studentData.adminName) {
    throw new Error('Invalid student data: Registration ID, Package Name, Duration, Batch, and Admin Name are required.');
  }
  const sheet = getSheetByName(studentData.batch);

  // Ensure the sheet has an "Admin Name" column
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (header.length < 5 || header[4] !== "Admin Name") {
    // Add Admin Name column if missing
    sheet.insertColumnAfter(4); // Insert after the Date column
    sheet.getRange(1, 5).setValue("Admin Name");
  }

  const now = new Date();
  sheet.appendRow([
    String(studentData.registrationId),
    studentData.packageName,
    studentData.duration,
    now,
    studentData.adminName
  ]);
}

function handleGetData() {
  const srilankaTimeZone = "Asia/Colombo";
  const packageSheet = getSheetByName('Packages');
  const packageValues = packageSheet.getDataRange().getValues();
  const packages = [];
  for (let i = 1; i < packageValues.length; i++) {
    const row = packageValues[i];
    if (row[0] && row[1]) {
      packages.push([String(row[0]), row[1]]);
    }
  }
  const batches = ['2025 Batch', '2026 Batch', '2027 Batch'];
  const students = [];
  batches.forEach(batch => {
    const sheet = getSheetByName(batch);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      let dateValue = row[3];
      let formattedDateForFrontend = null;
      if (dateValue instanceof Date) {
        formattedDateForFrontend = Utilities.formatDate(dateValue, srilankaTimeZone, "yyyy-MM-dd");
      } else if (typeof dateValue === 'string') {
        try {
          const parsedDate = new Date(dateValue);
          if (!isNaN(parsedDate.getTime())) {
            formattedDateForFrontend = Utilities.formatDate(parsedDate, srilankaTimeZone, "yyyy-MM-dd");
          } else {
            formattedDateForFrontend = dateValue;
          }
        } catch (e) {
          formattedDateForFrontend = dateValue;
        }
      } else if (typeof dateValue === 'number') {
        const excelEpoch = new Date('1899-12-30T00:00:00Z');
        const msPerDay = 24 * 60 * 60 * 1000;
        const dateFromNumber = new Date(excelEpoch.getTime() + dateValue * msPerDay);
        formattedDateForFrontend = Utilities.formatDate(dateFromNumber, srilankaTimeZone, "yyyy-MM-dd");
      }
      if (row[0]) {
        students.push({
          registrationId: String(row[0]),
          packageName: row[1],
          duration: row[2],
          date: formattedDateForFrontend,
          batch: batch,
          adminName: row[4] || '', // Add admin name if present
          rowIndex: i + 1
        });
      }
    }
  });
  // Return admin sheet data for report dropdown
  const adminSheet = getSheetByName('admin');
  const adminValues = adminSheet.getDataRange().getValues();
  return { packages, students, admins: adminValues };
}

function handleSearchStudent(regId) {
  if (!regId) throw new Error('Registration ID is required for search.');
  const batches = ['2025 Batch', '2026 Batch', '2027 Batch'];
  const results = [];
  const srilankaTimeZone = "Asia/Colombo";
  const searchRegId = String(regId);
  batches.forEach(batch => {
    const sheet = getSheetByName(batch);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      let dateValue = row[3];
      let formattedDateForFrontend = null;
      if (dateValue instanceof Date) {
        formattedDateForFrontend = Utilities.formatDate(dateValue, srilankaTimeZone, "yyyy-MM-dd");
      } else if (typeof dateValue === 'string') {
        try {
          const parsedDate = new Date(dateValue);
          if (!isNaN(parsedDate.getTime())) {
            formattedDateForFrontend = Utilities.formatDate(parsedDate, srilankaTimeZone, "yyyy-MM-dd");
          } else {
            formattedDateForFrontend = dateValue;
          }
        } catch (e) {
          formattedDateForFrontend = dateValue;
        }
      } else if (typeof dateValue === 'number') {
        const excelEpoch = new Date('1899-12-30T00:00:00Z');
        const msPerDay = 24 * 60 * 60 * 1000;
        const dateFromNumber = new Date(excelEpoch.getTime() + dateValue * msPerDay);
        formattedDateForFrontend = Utilities.formatDate(dateFromNumber, srilankaTimeZone, "yyyy-MM-dd");
      }
      if (String(row[0]) === searchRegId) {
        results.push({
          rowIndex: i + 1,
          batch: batch,
          registrationId: String(row[0]),
          packageName: row[1],
          duration: row[2],
          date: formattedDateForFrontend,
          adminName: row[4] || ''
        });
      }
    }
  });
  return results;
}

function handleUpdateStudent(updatedData) {
  if (!updatedData || !updatedData.batch || !updatedData.rowIndex || !updatedData.registrationId || !updatedData.packageName || !updatedData.duration || !updatedData.date) {
    throw new Error('Invalid update data: All fields are required for update.');
  }
  const sheet = getSheetByName(updatedData.batch);
  const rowIndex = updatedData.rowIndex;
  let dateToStore = new Date(updatedData.date);
  if (isNaN(dateToStore.getTime())) {
    throw new Error('Invalid date format received for update. Expected YYYY-MM-DD.');
  }
  // Get admin name in row if present, for update (not sent from frontend)
  let adminName = '';
  try {
    adminName = sheet.getRange(rowIndex, 5).getValue();
  } catch (e) {}
  sheet.getRange(rowIndex, 1, 1, 5).setValues([[
    String(updatedData.registrationId),
    updatedData.packageName,
    updatedData.duration,
    dateToStore,
    adminName
  ]]);
}

function handleDeleteStudent(registrationId) {
  if (!registrationId) throw new Error('Registration ID is required for deletion.');
  const batches = ['2025 Batch', '2026 Batch', '2027 Batch'];
  let deleted = false;
  const deleteRegId = String(registrationId);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const sheet = getSheetByName(batch);
    const values = sheet.getDataRange().getValues();
    for (let j = values.length - 1; j >= 1; j--) {
      const row = values[j];
      if (String(row[0]) === deleteRegId) {
        sheet.deleteRow(j + 1);
        deleted = true;
      }
    }
  }
  if (!deleted) {
    throw new Error('Record not found for deletion.');
  }
}

function handleSearchByDate(searchDateStr) {
  if (!searchDateStr) throw new Error('Date is required for search.');
  const batches = ['2025 Batch', '2026 Batch', '2027 Batch'];
  const results = [];
  const srilankaTimeZone = "Asia/Colombo";
  batches.forEach(batch => {
    const sheet = getSheetByName(batch);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      let recordDateValue = row[3];
      let formattedRecordDateForComparison = null;
      if (recordDateValue instanceof Date) {
        formattedRecordDateForComparison = Utilities.formatDate(recordDateValue, srilankaTimeZone, "yyyy-MM-dd");
      } else if (typeof recordDateValue === 'string') {
        try {
          const parsedDate = new Date(recordDateValue);
          if (!isNaN(parsedDate.getTime())) {
            formattedRecordDateForComparison = Utilities.formatDate(parsedDate, srilankaTimeZone, "yyyy-MM-dd");
          }
        } catch (e) {}
      } else if (typeof recordDateValue === 'number') {
        const excelEpoch = new Date('1899-12-30T00:00:00Z');
        const msPerDay = 24 * 60 * 60 * 1000;
        const dateFromNumber = new Date(excelEpoch.getTime() + recordDateValue * msPerDay);
        formattedRecordDateForComparison = Utilities.formatDate(dateFromNumber, srilankaTimeZone, "yyyy-MM-dd");
      }
      if (String(row[0]) && formattedRecordDateForComparison === searchDateStr) {
        results.push({
          rowIndex: i + 1,
          batch: batch,
          registrationId: String(row[0]),
          packageName: row[1],
          duration: row[2],
          date: formattedRecordDateForComparison,
          adminName: row[4] || ''
        });
      }
    }
  });
  return results;
}

function handleGetPackageCountReport(startDateStr, endDateStr) {
  const srilankaTimeZone = "Asia/Colombo";
  const packagesTaken = {};
  let totalPackagesForPeriod = 0;
  const start = startDateStr ? new Date(startDateStr + 'T00:00:00') : null;
  const end = endDateStr ? new Date(endDateStr + 'T23:59:59') : null;
  const batches = ['2025 Batch', '2026 Batch', '2027 Batch'];
  batches.forEach(batch => {
    const sheet = getSheetByName(batch);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      let recordDateValue = row[3];
      let recordDate = null;
      if (recordDateValue instanceof Date) {
        recordDate = recordDateValue;
      } else if (typeof recordDateValue === 'string') {
        try {
          recordDate = new Date(recordDateValue);
        } catch (e) {}
      } else if (typeof recordDateValue === 'number') {
        const excelEpoch = new Date('1899-12-30T00:00:00Z');
        const msPerDay = 24 * 60 * 60 * 1000;
        recordDate = new Date(excelEpoch.getTime() + recordDateValue * msPerDay);
      }
      if (recordDate && !isNaN(recordDate.getTime())) {
        let isInRange = true;
        if (start && recordDate < start) {
          isInRange = false;
        }
        if (end && recordDate > end) {
          isInRange = false;
        }
        if (isInRange) {
          const packageName = row[1];
          if (packageName) {
            packagesTaken[packageName] = (packagesTaken[packageName] || 0) + 1;
            totalPackagesForPeriod++;
          }
        }
      }
    }
  });
  return { packageCounts: packagesTaken, totalCount: totalPackagesForPeriod };
}

function handleLogin(username, password) {
  if (!username || !password) return false;
  try {
    const sheet = getSheetByName('admin');
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (
        row[0] && row[1] &&
        String(row[0]).trim() === String(username).trim() &&
        String(row[1]).trim() === String(password).trim()
      ) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

function handleGetAdminReport(adminName, startDateStr, endDateStr) {
  if (!adminName || !startDateStr || !endDateStr) {
    throw new Error('Admin name, start date, and end date are required.');
  }
  const srilankaTimeZone = "Asia/Colombo";
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T23:59:59');
  const batches = ['2025 Batch', '2026 Batch', '2027 Batch'];
  const packageCounts = {};
  let totalCount = 0;

  batches.forEach(batch => {
    const sheet = getSheetByName(batch);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      // Defensive: row[4] == adminName, row[3] == date, row[1] == package name
      const rowAdmin = row[4] ? String(row[4]).trim() : '';
      let recordDateValue = row[3];
      let recordDate = null;

      if (recordDateValue instanceof Date) {
        recordDate = recordDateValue;
      } else if (typeof recordDateValue === 'string') {
        recordDate = !isNaN(Date.parse(recordDateValue)) ? new Date(recordDateValue) : null;
      } else if (typeof recordDateValue === 'number') {
        const excelEpoch = new Date('1899-12-30T00:00:00Z');
        const msPerDay = 24 * 60 * 60 * 1000;
        recordDate = new Date(excelEpoch.getTime() + recordDateValue * msPerDay);
      }

      if (
        rowAdmin === adminName &&
        recordDate &&
        !isNaN(recordDate.getTime()) &&
        recordDate >= start &&
        recordDate <= end
      ) {
        const packageName = row[1] ? String(row[1]) : '';
        if (packageName) {
          packageCounts[packageName] = (packageCounts[packageName] || 0) + 1;
          totalCount++;
        }
      }
    }
  });

  return { admin: adminName, startDate: startDateStr, endDate: endDateStr, packageCounts, totalCount };
}