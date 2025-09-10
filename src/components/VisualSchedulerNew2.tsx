import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Clock, Users, Calendar, GripVertical, Edit3 } from 'lucide-react';

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
}

interface TimeSlot {
  day: string;
  time: string;
  duration: number;
}

interface VisualSchedulerProps {
  sections: CourseSection[];
  onScheduleUpdate: (sectionId: number, schedule: TimeSlot) => void;
  onSectionUpdate: (section: CourseSection) => void;
}

// Days starting with Sunday
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 30-minute time slots from 8:00 AM to 10:00 PM
const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00'
];

const VisualScheduler: React.FC<VisualSchedulerProps> = ({
  sections = [],
  onScheduleUpdate,
  onSectionUpdate
}) => {
  const [scheduledSections, setScheduledSections] = useState<{[key: string]: CourseSection[]}>({});
  const [unscheduledSections, setUnscheduledSections] = useState<CourseSection[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<{[sectionId: number]: number}>({});

  useEffect(() => {
    // Initialize scheduled and unscheduled sections
    const scheduled: {[key: string]: CourseSection[]} = {};
    const unscheduled: CourseSection[] = [];

    // Initialize all time slots
    TIME_SLOTS.forEach(time => {
      DAYS_OF_WEEK.forEach(day => {
        scheduled[`${day}-${time}`] = [];
      });
    });

    // Parse existing schedules
    sections.forEach(section => {
      const schedule = parseScheduleString(section.schedule);
      if (schedule.day && schedule.time) {
        const key = `${schedule.day}-${schedule.time}`;
        if (!scheduled[key]) scheduled[key] = [];
        scheduled[key].push(section);
      } else {
        unscheduled.push(section);
      }
    });

    setScheduledSections(scheduled);
    setUnscheduledSections(unscheduled);
  }, [sections]);

  const parseScheduleString = (schedule: string) => {
    if (!schedule || schedule === 'TBD') {
      return { day: '', time: '', duration: 60 };
    }

    const parts = schedule.split(' ');
    if (parts.length >= 2) {
      const day = parts[0];
      const timeRange = parts[1];
      const time = timeRange.split('-')[0];
      return { day, time, duration: 60 };
    }

    return { day: '', time: '', duration: 60 };
  };

  const formatScheduleString = (day: string, time: string, duration: number = 60) => {
    const start = new Date(`2000-01-01T${time}`);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const endTimeStr = end.toTimeString().slice(0, 5);
    return `${day} ${time}-${endTimeStr}`;
  };

  const getOccupiedSlots = (day: string, startTime: string, duration: number) => {
    const occupiedSlots: string[] = [];
    const startIndex = TIME_SLOTS.indexOf(startTime);

    if (startIndex === -1) return occupiedSlots;

    // Calculate how many 30-minute slots this duration occupies
    const slotsNeeded = Math.ceil(duration / 30);

    for (let i = 0; i < slotsNeeded; i++) {
      const slotIndex = startIndex + i;
      if (slotIndex < TIME_SLOTS.length) {
        occupiedSlots.push(`${day}-${TIME_SLOTS[slotIndex]}`);
      }
    }

    return occupiedSlots;
  };

  const handleDragEnd = (result: any) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    const sectionId = parseInt(draggableId);
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const duration = selectedDuration[sectionId] || 60;

    // Remove from source
    if (source.droppableId === 'unscheduled') {
      setUnscheduledSections(prev => prev.filter(s => s.id !== sectionId));
    } else {
      // Remove from all occupied slots
      const sourceDay = source.droppableId.split('-')[0];
      const sourceTime = source.droppableId.split('-')[1];
      const occupiedSlots = getOccupiedSlots(sourceDay, sourceTime, duration);

      setScheduledSections(prev => {
        const updated = { ...prev };
        occupiedSlots.forEach(slot => {
          if (updated[slot]) {
            updated[slot] = updated[slot].filter(s => s.id !== sectionId);
          }
        });
        return updated;
      });
    }

    // Add to destination
    if (destination.droppableId === 'unscheduled') {
      setUnscheduledSections(prev => [...prev, section]);
      // Update schedule to TBD
      onScheduleUpdate(sectionId, { day: '', time: '', duration });
    } else {
      const [day, time] = destination.droppableId.split('-');

      // Check if the slots are available
      const occupiedSlots = getOccupiedSlots(day, time, duration);
      const hasConflict = occupiedSlots.some(slot =>
        scheduledSections[slot] && scheduledSections[slot].length > 0
      );

      if (hasConflict) {
        alert('Time slot conflict! Please choose a different time or duration.');
        // Restore to original position
        if (source.droppableId === 'unscheduled') {
          setUnscheduledSections(prev => [...prev, section]);
        } else {
          const [sourceDay, sourceTime] = source.droppableId.split('-');
          const sourceOccupiedSlots = getOccupiedSlots(sourceDay, sourceTime, duration);
          setScheduledSections(prev => {
            const updated = { ...prev };
            sourceOccupiedSlots.forEach(slot => {
              if (!updated[slot]) updated[slot] = [];
              updated[slot].push(section);
            });
            return updated;
          });
        }
        return;
      }

      // Add to occupied slots
      setScheduledSections(prev => {
        const updated = { ...prev };
        occupiedSlots.forEach(slot => {
          if (!updated[slot]) updated[slot] = [];
          updated[slot].push(section);
        });
        return updated;
      });

      // Update schedule
      const timeSlot: TimeSlot = { day, time, duration };
      onScheduleUpdate(sectionId, timeSlot);
    }
  };

  const handleDurationChange = (sectionId: number, duration: number) => {
    setSelectedDuration(prev => ({
      ...prev,
      [sectionId]: duration
    }));
  };

  const getSectionDuration = (sectionId: number) => {
    return selectedDuration[sectionId] || 60;
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-foreground flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-primary" />
            Visual Schedule Manager
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Drag sections to schedule them on the timetable (30-min slots)
          </p>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        {/* Unscheduled sections - TOP */}
        <div className="mb-8 border-b border-border pb-6">
          <h4 className="text-lg font-medium text-foreground mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-muted-foreground" />
            Unscheduled Sections ({unscheduledSections.length})
          </h4>

          <Droppable droppableId="unscheduled">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-[120px] p-4 rounded-lg border-2 border-dashed transition-colors ${
                  snapshot.isDraggingOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {unscheduledSections.map((section, index) => (
                    <Draggable
                      key={section.id}
                      draggableId={section.id.toString()}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`p-3 bg-muted rounded-lg border border-border cursor-move transition-all ${
                            snapshot.isDragging ? 'shadow-lg rotate-1 scale-105' : 'hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-foreground text-sm truncate flex-1">
                              {section.course_name || section.section_name}
                            </h5>
                            <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                            <div className="flex items-center">
                              <Users className="w-3 h-3 mr-1" />
                              <span>{section.current_students}/{section.max_students}</span>
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              <span>{getSectionDuration(section.id)}m</span>
                            </div>
                          </div>
                          <div className="text-center">
                            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                              Drag to schedule
                            </span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                </div>
                {unscheduledSections.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">All sections are scheduled!</p>
                    <p className="text-xs mt-1">Drag sections here to unschedule them</p>
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>

        {/* Duration Controls - MIDDLE */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center">
            <Edit3 className="w-4 h-4 mr-2" />
            Section Duration Settings
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {sections.map(section => (
              <div key={section.id} className="flex items-center space-x-3 p-2 bg-background rounded border">
                <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                  {section.course_name || section.section_name}
                </span>
                <select
                  value={getSectionDuration(section.id)}
                  onChange={(e) => handleDurationChange(section.id, parseInt(e.target.value))}
                  className="text-xs px-2 py-1 border border-border rounded bg-background min-w-[80px]"
                >
                  <option value={30}>30m</option>
                  <option value={60}>1h</option>
                  <option value={90}>1.5h</option>
                  <option value={120}>2h</option>
                  <option value={150}>2.5h</option>
                  <option value={180}>3h</option>
                  <option value={210}>3.5h</option>
                  <option value={240}>4h</option>
                  <option value={270}>4.5h</option>
                  <option value={300}>5h</option>
                  <option value={330}>5.5h</option>
                  <option value={360}>6h</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Timetable - BOTTOM */}
        <div className="border-t border-border pt-6">
          <h4 className="text-lg font-medium text-foreground mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-primary" />
            Weekly Schedule (30-min slots)
          </h4>

          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              {/* Header */}
              <div className="grid grid-cols-8 gap-1 mb-2">
                <div className="p-2 bg-muted rounded-md text-center">
                  <span className="text-sm font-medium text-muted-foreground">Time</span>
                </div>
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="p-2 bg-muted rounded-md text-center">
                    <span className="text-sm font-medium text-muted-foreground">{day}</span>
                  </div>
                ))}
              </div>

              {/* Time slots grid */}
              <div className="space-y-1">
                {TIME_SLOTS.map(time => (
                  <div key={time} className="grid grid-cols-8 gap-1">
                    <div className="p-2 bg-muted/50 rounded-md text-center border-r border-border">
                      <span className="text-xs text-muted-foreground font-medium">{time}</span>
                    </div>
                    {DAYS_OF_WEEK.map(day => {
                      const slotKey = `${day}-${time}`;
                      const sectionsInSlot = scheduledSections[slotKey] || [];
                      const isOccupied = sectionsInSlot.length > 0;

                      return (
                        <Droppable key={slotKey} droppableId={slotKey}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`min-h-[40px] p-1 rounded-md border-2 border-dashed transition-colors ${
                                snapshot.isDraggingOver
                                  ? 'border-primary bg-primary/10'
                                  : isOccupied
                                  ? 'border-primary/30 bg-primary/5'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              {sectionsInSlot.map((section, index) => (
                                <Draggable
                                  key={section.id}
                                  draggableId={section.id.toString()}
                                  index={index}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`p-2 mb-1 rounded bg-gradient-gold text-secondary text-xs cursor-move transition-all ${
                                        snapshot.isDragging ? 'rotate-2 shadow-lg scale-105' : ''
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium truncate flex-1">
                                          {section.course_name || section.section_name}
                                        </span>
                                        <GripVertical className="w-3 h-3 flex-shrink-0 ml-1" />
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="flex items-center">
                                          <Users className="w-3 h-3 mr-1" />
                                          <span>{section.current_students}/{section.max_students}</span>
                                        </div>
                                        <div className="flex items-center">
                                          <Clock className="w-3 h-3 mr-1" />
                                          <span>{getSectionDuration(section.id)}m</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};

export default VisualScheduler;
