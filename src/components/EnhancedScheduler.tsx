import React, { useState, useEffect } from 'react';
import { Clock, Users, Calendar, Edit3, Plus, X, Save } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslatedCategory } from '../utils/categoryUtils';

interface CourseSection {
  id: number;
  course_id: number;
  section_name: string;
  schedule: string;
  start_date: string | null;
  end_date: string | null;
  max_students: number;
  current_students: number;
  is_active: boolean;
  created_at: string;
  course_name?: string;
  course_category?: string;
}

interface ScheduleEntry {
  id: number;
  day: string;
  start_time: string;
  end_time: string;
  section: CourseSection;
}

interface EnhancedSchedulerProps {
  sections: CourseSection[];
  onScheduleUpdate: (sectionId: number, schedule: string) => void;
  onSectionUpdate: (section: CourseSection) => void;
}

// Days starting with Sunday
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Time slots from 8:00 AM to 10:00 PM
const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00'
];

const EnhancedScheduler: React.FC<EnhancedSchedulerProps> = ({
  sections = [],
  onScheduleUpdate,
  onSectionUpdate
}) => {
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [selectedSection, setSelectedSection] = useState<CourseSection | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    day: 'Mon',
    start_time: '09:00',
    end_time: '11:00'
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { t } = useLanguage();
  const { translateCategory, getCategoryColors } = useTranslatedCategory();

  useEffect(() => {
    // Parse existing schedules
    const entries: ScheduleEntry[] = [];
    sections.forEach(section => {
      const schedule = parseScheduleString(section.schedule);
      if (schedule.day && schedule.start_time && schedule.end_time) {
        entries.push({
          id: Date.now() + Math.random(), // Unique ID for the entry
          day: schedule.day,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          section
        });
      }
    });
    setScheduleEntries(entries);
  }, [sections]);

  const parseScheduleString = (schedule: string) => {
    if (!schedule || schedule === 'TBD') {
      return { day: '', start_time: '', end_time: '' };
    }

    const parts = schedule.split(' ');
    if (parts.length >= 2) {
      const day = parts[0];
      const timeRange = parts[1];
      const [start_time, end_time] = timeRange.split('-');
      return { day, start_time, end_time };
    }

    return { day: '', start_time: '', end_time: '' };
  };

  const formatScheduleString = (day: string, start_time: string, end_time: string) => {
    return `${day} ${start_time}-${end_time}`;
  };

  const handleAddSchedule = (section: CourseSection) => {
    setSelectedSection(section);
    setScheduleForm({
      day: 'Mon',
      start_time: '09:00',
      end_time: '11:00'
    });
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = () => {
    if (!selectedSection) return;

    const newSchedule = formatScheduleString(
      scheduleForm.day,
      scheduleForm.start_time,
      scheduleForm.end_time
    );

    // Update the section's schedule
    onScheduleUpdate(selectedSection.id, newSchedule);

    // Add to local entries
    const newEntry: ScheduleEntry = {
      id: Date.now() + Math.random(),
      day: scheduleForm.day,
      start_time: scheduleForm.start_time,
      end_time: scheduleForm.end_time,
      section: selectedSection
    };

    setScheduleEntries(prev => [...prev, newEntry]);
    setShowScheduleModal(false);
    setSelectedSection(null);
  };

  const handleRemoveSchedule = (entryId: number, sectionId: number) => {
    setScheduleEntries(prev => prev.filter(entry => entry.id !== entryId));
    onScheduleUpdate(sectionId, 'TBD');
  };

  const getSectionsForTimeSlot = (day: string, time: string) => {
    return scheduleEntries.filter(entry =>
      entry.day === day &&
      entry.start_time <= time &&
      entry.end_time > time
    );
  };

  const getTimeSlotHeight = (sections: ScheduleEntry[]) => {
    if (sections.length === 0) return 'h-8';
    return 'h-16'; // Fixed height for now
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-foreground flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-primary" />
            Enhanced Schedule Manager
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage course schedules with support for overlapping sections
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            {viewMode === 'grid' ? 'List View' : 'Grid View'}
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="grid grid-cols-8 gap-1 mb-2">
              <div className="p-2 text-sm font-medium text-muted-foreground">Time</div>
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="p-2 text-sm font-medium text-muted-foreground text-center">
                  {day}
                </div>
              ))}
            </div>

            {/* Time slots */}
            {TIME_SLOTS.map(time => (
              <div key={time} className="grid grid-cols-8 gap-1 mb-1">
                <div className="p-2 text-xs text-muted-foreground border-r border-border">
                  {time}
                </div>
                {DAYS_OF_WEEK.map(day => {
                  const sectionsInSlot = getSectionsForTimeSlot(day, time);
                  return (
                    <div
                      key={`${day}-${time}`}
                      className={`p-1 border border-border rounded min-h-[32px] ${
                        sectionsInSlot.length > 0 ? 'bg-primary/10' : 'bg-background'
                      }`}
                    >
                      {sectionsInSlot.map((entry, index) => (
                        <div
                          key={entry.id}
                          className={`text-xs p-1 mb-1 rounded truncate ${getCategoryColors(entry.section.course_category || '').bg} ${getCategoryColors(entry.section.course_category || '').text}`}
                          title={`${entry.section.course_name} - ${entry.section.section_name} (${translateCategory(entry.section.course_category || '')})`}
                        >
                          {entry.section.section_name}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* List view of scheduled sections */}
          <div className="space-y-2">
            {DAYS_OF_WEEK.map(day => {
              const daySections = scheduleEntries.filter(entry => entry.day === day);
              if (daySections.length === 0) return null;

              return (
                <div key={day} className="border border-border rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-3">{DAYS_FULL[DAYS_OF_WEEK.indexOf(day)]}</h4>
                  <div className="space-y-2">
                    {daySections.map(entry => (
                      <div key={entry.id} className={`flex items-center justify-between p-3 rounded border ${getCategoryColors(entry.section.course_category || '').border} ${getCategoryColors(entry.section.course_category || '').bg}`}>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{entry.section.course_name} - {entry.section.section_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {entry.start_time} - {entry.end_time}
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${getCategoryColors(entry.section.course_category || '').bg} ${getCategoryColors(entry.section.course_category || '').text}`}>
                            {translateCategory(entry.section.course_category || '')}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleRemoveSchedule(entry.id, entry.section.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unscheduled sections */}
      <div className="mt-8 border-t border-border pt-6">
        <h4 className="text-lg font-medium text-foreground mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-muted-foreground" />
          Unscheduled Sections ({sections.filter(s => s.schedule === 'TBD' || !s.schedule).length})
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections
            .filter(s => s.schedule === 'TBD' || !s.schedule || parseScheduleString(s.schedule).day === '')
            .map(section => (
              <div key={section.id} className={`p-4 border rounded-lg bg-background ${getCategoryColors(section.course_category || '').border}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h5 className="font-medium text-sm">{section.course_name} - {section.section_name}</h5>
                    <div className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${getCategoryColors(section.course_category || '').bg} ${getCategoryColors(section.course_category || '').text}`}>
                      {translateCategory(section.course_category || '')}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <Users className="w-3 h-3 mr-1" />
                      {section.current_students}/{section.max_students} students
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddSchedule(section)}
                    className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && selectedSection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Schedule Section</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1 hover:bg-secondary rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Course & Section</label>
                <p className="text-sm text-muted-foreground">{selectedSection.course_name} - {selectedSection.section_name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Day</label>
                <select
                  value={scheduleForm.day}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, day: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                >
                  {DAYS_OF_WEEK.map(day => (
                    <option key={day} value={day}>{DAYS_FULL[DAYS_OF_WEEK.indexOf(day)]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Start Time</label>
                  <select
                    value={scheduleForm.start_time}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  >
                    {TIME_SLOTS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">End Time</label>
                  <select
                    value={scheduleForm.end_time}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  >
                    {TIME_SLOTS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSchedule}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Save className="w-4 h-4 inline mr-2" />
                  Save Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedScheduler;
