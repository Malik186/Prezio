// src/utils/cronManager.js
const jobs = [];

const registerCronJob = (name, cronJob, associatedUser = null) => {
  jobs.push({ name, cronJob, associatedUser });
};

const listCronJobs = () => {
  return jobs.map(({ name, cronJob, associatedUser }) => ({
    name,
    running: cronJob.getStatus() === 'scheduled',
    nextRun: cronJob.nextDates().toISOString(),
    associatedUser: associatedUser || 'System'
  }));
};

module.exports = {
  registerCronJob,
  listCronJobs
};
