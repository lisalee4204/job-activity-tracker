import { JobSearchActivity } from '@/types/jobSearch';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const exportToCSV = (activities: JobSearchActivity[]) => {
  const headers = ['Date', 'Company', 'Job Title', 'Activity Type', 'Status', 'Contact Person', 'Contact Method', 'Job URL', 'Notes'];
  
  const rows = activities.map(activity => [
    format(new Date(activity.date), 'MM/dd/yyyy'),
    activity.companyName,
    activity.jobTitle,
    activity.activityType,
    activity.status || '',
    activity.contactPerson || '',
    activity.contactMethod || '',
    activity.jobDescriptionUrl || '',
    activity.notes || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `job-search-activities-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (activities: JobSearchActivity[], weeklyGoal: number) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.text('Job Search Activity Report', 14, 20);
  
  // Summary info
  doc.setFontSize(11);
  doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy')}`, 14, 30);
  doc.text(`Total Activities: ${activities.length}`, 14, 36);
  doc.text(`Weekly Goal: ${weeklyGoal} activities/week`, 14, 42);
  
  // Activity table
  const tableData = activities.map(activity => [
    format(new Date(activity.date), 'MM/dd/yyyy'),
    activity.companyName,
    activity.jobTitle,
    activity.activityType,
    activity.status || '-'
  ]);

  autoTable(doc, {
    head: [['Date', 'Company', 'Job Title', 'Activity Type', 'Status']],
    body: tableData,
    startY: 50,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save(`job-search-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};
