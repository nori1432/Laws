import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Clock, Users, Calendar, GripVertical } from 'lucide-react';

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
  duration: number; // in minutes
}

interface ScheduledSection extends CourseSection {
  day: string;
  startTime: string;
  duration: number;
}

interface VisualSchedulerProps {
  sections: CourseSection[];
  onScheduleUpdate: (sectionId: number, schedule: TimeSlot) => void;
  onSectionUpdate: (section: CourseSection) => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00'
];

const VisualScheduler: React.FC<VisualSchedulerProps> = ({
  sections,
  onScheduleUpdate,
  onSectionUpdate
}) => {
  const [scheduledSections, setScheduledSections] = useState<ScheduledSection[]>([]);
  const [draggedSection, setDraggedSection] = useState<CourseSection | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);

  useEffect(() => {
    // Validate sections data
    if (!sections || !Array.isArray(sections)) {
      console.warn('VisualScheduler: sections prop is not a valid array');
      setScheduledSections([]);
      return;
    }

    // Parse existing schedules and convert to visual format
    const parsedSections = sections
      .filter(section => section && typeof section === 'object' && section.id)
      .map(section => {
        const schedule = parseScheduleString(section.schedule);
        return {
          ...section,
          ...schedule
        };
      });
    setScheduledSections(parsedSections);
  }, [sections]);

  const parseScheduleString = (schedule: string): { day: string; startTime: string; duration: number } => {
    // Parse schedule string like "Monday 10:00-11:30" or "TBD"
    if (schedule === 'TBD' || !schedule) {
      return { day: '', startTime: '', duration: 60 };
    }

    const parts = schedule.split(' ');
    if (parts.length >= 2) {
      const day = parts[0];
      const timeRange = parts[1];
      const [startTime, endTime] = timeRange.split('-');

      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60); // minutes

      return { day, startTime, duration };
    }

    return { day: '', startTime: '', duration: 60 };
  };

  const formatScheduleString = (day: string, startTime: string, duration: number): string => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const endTime = end.toTimeString().slice(0, 5);
    return `${day} ${startTime}-${endTime}`;
  };

  const handleDragEnd = (result: any) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    // Extract the actual section ID from draggableId (remove 'scheduled-' or 'unscheduled-' prefix)
    const sectionId = parseInt(draggableId.replace(/^(scheduled-|unscheduled-)/, ''));
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    // Parse destination droppableId to get day and time
    const [day, time] = destination.droppableId.split('-');

    const timeSlot: TimeSlot = {
      day,
      time,
      duration: 60 // Default 1 hour
    };

    // Update the section's schedule
    const newSchedule = formatScheduleString(day, time, timeSlot.duration);

    // Update local state
    setScheduledSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, day, startTime: time, duration: timeSlot.duration }
        : s
    ));

    // Notify parent component
    onScheduleUpdate(sectionId, timeSlot);
  };

  const handleSectionClick = (section: CourseSection) => {
    setDraggedSection(section);
  };

  const getSectionsForTimeSlot = (day: string, time: string) => {
    return scheduledSections.filter(s =>
      s.day === day && s.startTime === time
    );
  };

  const getUnscheduledSections = () => {
    return sections.filter(section =>
      !scheduledSections.some(s => s.id === section.id && s.day && s.startTime)
    );
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
            Drag sections to schedule them on the timetable
          </p>
        </div>
      </div>

      {(!sections || sections.length === 0) ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading sections...</p>
        </div>
      ) : (

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-8 gap-1 mb-6">
          {/* Header row with days */}
          <div className="p-3 bg-muted rounded-md">
            <span className="text-sm font-medium text-muted-foreground">Time</span>
          </div>
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="p-3 bg-muted rounded-md text-center">
              <span className="text-sm font-medium text-muted-foreground">{day.slice(0, 3)}</span>
            </div>
          ))}

          {/* Time slots */}
          {TIME_SLOTS.map(time => (
            <React.Fragment key={time}>
              <div className="p-3 bg-muted/50 rounded-md border-r border-border">
                <span className="text-xs text-muted-foreground">{time}</span>
              </div>
              {DAYS_OF_WEEK.map(day => {
                const sectionsInSlot = getSectionsForTimeSlot(day, time);
                const droppableId = `${day}-${time}`;

                return (
                  <Droppable key={droppableId} droppableId={droppableId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[80px] p-2 rounded-md border-2 border-dashed transition-colors ${
                          snapshot.isDraggingOver
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {sectionsInSlot
                          .filter(section => section && section.id)
                          .map((section, index) => (
                          <Draggable
                            key={`scheduled-${section.id}`}
                            draggableId={`scheduled-${section.id}`}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-2 mb-1 rounded-md bg-gradient-gold text-secondary text-xs cursor-move transition-transform ${
                                  snapshot.isDragging ? 'rotate-3 shadow-lg' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium truncate">
                                    {section.course_name || `Section ${section.section_name}`}
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
                                    <span>{section.duration || 60}m</span>
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
            </React.Fragment>
          ))}
        </div>

        {/* Unscheduled sections */}
        <div className="border-t border-border pt-6">
          <h4 className="text-lg font-medium text-foreground mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-muted-foreground" />
            Unscheduled Sections
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getUnscheduledSections()
              .filter(section => section && section.id)
              .map((section, index) => (
              <Draggable
                key={`unscheduled-${section.id}`}
                draggableId={`unscheduled-${section.id}`}
                index={index}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`p-4 bg-muted rounded-lg border border-border cursor-move transition-all ${
                      snapshot.isDragging ? 'shadow-lg rotate-2' : 'hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-foreground">
                        {section.course_name || section.section_name}
                      </h5>
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        <span>{section.current_students}/{section.max_students} students</span>
                      </div>
                      <span className="text-xs bg-muted-foreground/20 px-2 py-1 rounded">
                        Drag to schedule
                      </span>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
          </div>
          {getUnscheduledSections().length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>All sections are scheduled!</p>
            </div>
          )}
        </div>
      </DragDropContext>
      )}
    </div>
  );
};

export default VisualScheduler;
