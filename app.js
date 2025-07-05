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
      response = {
        success: true,
        message: 'Package added successfully'
      };
    }
    else if (action === 'assignPackage') {
      handleAssignStudent(data.studentData);
      response = {
        success: true,
        message: 'Student package assigned successfully'
      };
    }
    else if (action === 'getData') {
      const dataResult = handleGetData();
      response = {
        success: true,
        data: dataResult,
        message: 'Data fetched successfully'
      };
    }
    else if (action === 'searchStudent') {
      const records = handleSearchStudent(data.registrationId);
      response = {
        success: true,
        data: records,
        message: 'Student records fetched successfully'
      };
    }
    else if (action === 'updateStudent') {
      handleUpdateStudent(data.updatedData);
      response = {
        success: true,
        message: 'Student data updated successfully'
      };
    }
    else if (action === 'deleteStudent') {
      handleDeleteStudent(data.registrationId);
      response = {
        success: true,
        message: 'Student record deleted successfully'
      };
    }
    else if (action === 'searchByDate') {
      const records = handleSearchByDate(data.date);
      response = {
        success: true,
        data: records,
        message: 'Records for the date fetched successfully'
      };
    }
    else {
      response = {
        success: false,
        message: 'Unknown action: ' + action
      };
    }

    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // Log the error for debugging in Apps Script logs
    console.error("Error in doPost:", err.message, err.stack);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Server error: ' + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Helper function to get a sheet by name.
 * @param {string} name The name of the sheet.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The sheet object.
 * @throws {Error} If the sheet is not found.
 */
function getSheetByName(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error(`Sheet "${name}" not found. Please ensure all batch sheets (e.g., '2025 Batch') and 'Packages' sheet exist.`);
  }
  return sheet;
}

/**
 * Handles adding a new package to the 'Packages' sheet.
 * @param {object} packageData - Object containing package ID and name.
 */
function handleAddPackage(packageData) {
  if (!packageData || !packageData.id || !packageData.name) {
    throw new Error('Invalid package data: ID and Name are required.');
  }
  const sheet = getSheetByName('Packages');
  sheet.appendRow([packageData.id, packageData.name]);
}

/**
 * Handles assigning a package to a student and records it in the respective batch sheet.
 * The date recorded will be the current date in Sri Lankan time.
 * @param {object} studentData - Object containing student's registration ID, package name, duration, and batch.
 */
function handleAssignStudent(studentData) {
  if (!studentData || !studentData.registrationId || !studentData.packageName || !studentData.duration || !studentData.batch) {
    throw new Error('Invalid student data: Registration ID, Package Name, Duration, and Batch are required.');
  }
  const sheet = getSheetByName(studentData.batch);
  const now = new Date();
  // Store the date as a Date object in the sheet.
  // Google Sheets will format it based on cell settings (ensure date column is formatted as Date).
  sheet.appendRow([studentData.registrationId, studentData.packageName, studentData.duration, now]);
}

/**
 * Fetches all packages and student records from the respective sheets.
 * Dates from student records are now converted to YYYY-MM-DD in 'Asia/Colombo' timezone for the frontend.
 * @returns {object} An object containing arrays of packages and student records.
 */
function handleGetData() {
  const srilankaTimeZone = "Asia/Colombo";

  // Packages
  const packageSheet = getSheetByName('Packages');
  const packageValues = packageSheet.getDataRange().getValues();
  const packages = [];
  for (let i = 1; i < packageValues.length; i++) {
    const row = packageValues[i];
    if (row[0] && row[1]) {
      packages.push([row[0], row[1]]);
    }
  }

  // Students
  const batches = ['2025 Batch', '2026 Batch', '2027 Batch'];
  const students = [];
  batches.forEach(batch => {
    const sheet = getSheetByName(batch);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      let dateValue = row[3]; // Date column from the sheet
      let formattedDateForFrontend = null;

      // Format the date value from sheet to YYYY-MM-DD string for frontend display
      if (dateValue instanceof Date) {
        formattedDateForFrontend = Utilities.formatDate(dateValue, srilankaTimeZone, "yyyy-MM-dd");
      } else if (typeof dateValue === 'string') {
        try {
          const parsedDate = new Date(dateValue); // Attempt to parse string to Date
          if (!isNaN(parsedDate.getTime())) {
            formattedDateForFrontend = Utilities.formatDate(parsedDate, srilankaTimeZone, "yyyy-MM-dd");
          } else {
            formattedDateForFrontend = dateValue; // Keep original if not a valid date string
          }
        } catch (e) {
          formattedDateForFrontend = dateValue; // Fallback
        }
      } else if (typeof dateValue === 'number') {
        // Handle Google Sheet's numeric date format (days since 1899-12-30)
        const excelEpoch = new Date('1899-12-30T00:00:00Z');
        const msPerDay = 24 * 60 * 60 * 1000;
        const dateFromNumber = new Date(excelEpoch.getTime() + dateValue * msPerDay);
        formattedDateForFrontend = Utilities.formatDate(dateFromNumber, srilankaTimeZone, "yyyy-MM-dd");
      }
      
      // Log for debugging: what date is being sent to frontend
      // console.log(`[handleGetData] Batch: ${batch}, RegID: ${row[0]}, Date from sheet: ${dateValue}, Formatted for frontend: ${formattedDateForFrontend}`);

      if (row[0]) {
        students.push({
          registrationId: row[0],
          packageName: row[1],
          duration: row[2],
          date: formattedDateForFrontend, // Send YYYY-MM-DD string in SL time
          batch: batch,
          rowIndex: i + 1
        });
      }
    }
  });

  return { packages, students };
}

/**
 * Searches for student records by registration ID across all batch sheets.
 * Dates are now converted to YYYY-MM-DD in 'Asia/Colombo' timezone for the frontend.
 * @param {string} regId - The registration ID to search for.
 * @returns {Array<object>} An array of matching student records.
 */
function handleSearchStudent(regId) {
  if (!regId) throw new Error('Registration ID is required for search.');
  const batches = ['2025 Batch', '2026 Batch', '2027 Batch'];
  const results = [];
  const srilankaTimeZone = "Asia/Colombo";

  batches.forEach(batch => {
    const sheet = getSheetByName(batch);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      let dateValue = row[3]; // Date column from the sheet
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
      
      // console.log(`[handleSearchStudent] Batch: ${batch}, RegID: ${row[0]}, Date from sheet: ${dateValue}, Formatted for frontend: ${formattedDateForFrontend}`);

      if (row[0] === regId) {
        results.push({
          rowIndex: i + 1,
          batch: batch,
          registrationId: row[0],
          packageName: row[1],
          duration: row[2],
          date: formattedDateForFrontend // Send YYYY-MM-DD string in SL time
        });
      }
    }
  });
  return results;
}

/**
 * Updates an existing student record in the Google Sheet.
 * The incoming date string (YYYY-MM-DD) is converted to a Date object for storage.
 * @param {object} updatedData - Object containing updated student details and rowIndex.
 */
function handleUpdateStudent(updatedData) {
  if (!updatedData || !updatedData.batch || !updatedData.rowIndex || !updatedData.registrationId || !updatedData.packageName || !updatedData.duration || !updatedData.date) {
    throw new Error('Invalid update data: All fields are required for update.');
  }

  const sheet = getSheetByName(updatedData.batch);
  const rowIndex = updatedData.rowIndex;

  // Convert the YYYY-MM-DD string from frontend to a Date object for the sheet.
  // Google Sheets will handle the display based on its settings.
  let dateToStore = new Date(updatedData.date);
  if (isNaN(dateToStore.getTime())) {
    throw new Error('Invalid date format received for update. Expected YYYY-MM-DD.');
  }

  // Set the values for the specified row and columns
  sheet.getRange(rowIndex, 1, 1, 4).setValues([[
    updatedData.registrationId,
    updatedData.packageName,
    updatedData.duration,
    dateToStore // Store as Date object
  ]]);
}

/**
 * Deletes a student record based on registration ID.
 * @param {string} registrationId - The registration ID of the record to delete.
 */
function handleDeleteStudent(registrationId) {
  if (!registrationId) throw new Error('Registration ID is required for deletion.');
  const batches = ['2025 Batch', '2026 Batch', '2027 Batch'];
  let deleted = false;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const sheet = getSheetByName(batch);
    const values = sheet.getDataRange().getValues();

    // Iterate backwards to safely delete rows without affecting loop index
    for (let j = values.length - 1; j >= 1; j--) { // Start from last row, skip header
      const row = values[j];
      if (row[0] === registrationId) {
        sheet.deleteRow(j + 1); // j + 1 because sheet rows are 1-indexed
        deleted = true;
        // If you only want to delete the first occurrence, uncomment `break`
        // break;
      }
    }
  }

  if (!deleted) {
    throw new Error('Record not found for deletion.');
  }
}

/**
 * Searches for student records by a specific date.
 * Compares dates in the 'Asia/Colombo' timezone.
 * @param {string} searchDateStr - The date string (YYYY-MM-DD) to search for.
 * @returns {Array<object>} An array of matching student records.
 */
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
      let recordDateValue = row[3]; // Date column from the sheet
      let formattedRecordDateForComparison = null; // This will be YYYY-MM-DD in SL time

      // Format the date from the sheet to YYYY-MM-DD in Sri Lankan time for comparison
      if (recordDateValue instanceof Date) {
        formattedRecordDateForComparison = Utilities.formatDate(recordDateValue, srilankaTimeZone, "yyyy-MM-dd");
      } else if (typeof recordDateValue === 'string') {
        try {
          const parsedDate = new Date(recordDateValue);
          if (!isNaN(parsedDate.getTime())) {
            formattedRecordDateForComparison = Utilities.formatDate(parsedDate, srilankaTimeZone, "yyyy-MM-dd");
          }
        } catch (e) {
          // Do nothing, will remain null
        }
      } else if (typeof recordDateValue === 'number') {
        const excelEpoch = new Date('1899-12-30T00:00:00Z');
        const msPerDay = 24 * 60 * 60 * 1000;
        const dateFromNumber = new Date(excelEpoch.getTime() + recordDateValue * msPerDay);
        formattedRecordDateForComparison = Utilities.formatDate(dateFromNumber, srilankaTimeZone, "yyyy-MM-dd");
      }
      
      // console.log(`[handleSearchByDate] Batch: ${batch}, RegID: ${row[0]}, Sheet Date: ${recordDateValue}, Formatted for comparison: ${formattedRecordDateForComparison}, Search Date: ${searchDateStr}`);

      // Compare the formatted sheet date with the search date string
      if (formattedRecordDateForComparison === searchDateStr) {
        results.push({
          rowIndex: i + 1,
          batch: batch,
          registrationId: row[0],
          packageName: row[1],
          duration: row[2],
          date: formattedRecordDateForComparison // Send YYYY-MM-DD string in SL time
        });
      }
    }
  });
  return results;
}