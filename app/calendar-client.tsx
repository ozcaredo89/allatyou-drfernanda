"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { supabase } from '../utils/supabase/client';
import { MessageCircle, Search, UserPlus, Scissors, Settings, Edit2, Eye, EyeOff, Plus, Users, Instagram, X } from 'lucide-react';
import { ManageClientsModal } from './components/manage-clients-modal';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'es': es };
const localizer = dateFnsLocalizer({
  format, parse, getDay, locales,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
});

export function AdminCalendarClient() {
  const [events, setEvents] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  // Estados de Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isServicesModalOpen, setIsServicesModalOpen] = useState(false);
  const [isClientsModalOpen, setIsClientsModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isNewClient, setIsNewClient] = useState(true);

  // Estado Formulario Citas
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    serviceId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    notes: ''
  });

  // Estado Formulario Servicios
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceFormData, setServiceFormData] = useState({
    title: '',
    duration_min: 60,
    price: ''
  });

  // Estado Modal Detalles Cita
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const whatsappNumber = "+573204153349";
  const whatsappMessage = encodeURIComponent("Hola Jennifer! Estoy interesad@ en agendar un arreglo de uñas ¿Me puedes agendar?");

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    // 1. Cargar Citas
    const { data: appts, error: apptError } = await supabase
      .from('appointments')
      .select(`id, start_time, end_time, notes, clients(name, phone), services(title)`);

    if (apptError) console.error(apptError);

    setEvents(appts?.map((app: any) => ({
      id: app.id,
      title: `💅 ${app.clients?.name || 'Cita'} ${app.services?.title ? `- ${app.services.title}` : ''}`,
      start: new Date(app.start_time),
      end: new Date(app.end_time),
      clientName: app.clients?.name,
      clientPhone: app.clients?.phone,
      serviceTitle: app.services?.title,
      notes: app.notes
    })) || []);

    // 2. Cargar TODOS los Servicios (para el panel de administración)
    const { data: svcs } = await supabase.from('services').select('*').order('id', { ascending: true });
    setServices(svcs || []);
  };

  // --- LÓGICA DE CITAS ---
  const checkClient = async (phone: string) => {
    setFormData(prev => ({ ...prev, clientPhone: phone }));
    if (phone.length >= 7) {
      const { data } = await supabase.from('clients').select('name, notes').eq('phone', phone).single();
      if (data) {
        setFormData(prev => ({ ...prev, clientName: data.name, notes: data.notes || '' }));
        setIsNewClient(false);
      } else {
        setIsNewClient(true);
      }
    } else {
      setIsNewClient(true);
    }
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let clientId;
      if (isNewClient) {
        const { data: newClient, error: cErr } = await supabase
          .from('clients')
          .insert([{ name: formData.clientName, phone: formData.clientPhone, notes: formData.notes }])
          .select().single();
        if (cErr) throw cErr;
        clientId = newClient.id;
      } else {
        const { data: extClient } = await supabase.from('clients').select('id').eq('phone', formData.clientPhone).single();
        clientId = extClient?.id;
      }

      if (clientId) {
        const start = new Date(`${formData.date}T${formData.time}`);
        const selectedService = services.find(s => s.id.toString() === formData.serviceId);
        const duration = selectedService ? selectedService.duration_min : 60;
        const end = addMinutes(start, duration);

        const { error: aErr } = await supabase.from('appointments').insert([{
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          client_id: clientId,
          service_id: formData.serviceId || null,
          status: 'confirmed',
          notes: formData.notes
        }]);

        if (aErr) throw aErr;

        setIsModalOpen(false);
        setFormData({ clientName: '', clientPhone: '', serviceId: '', date: format(new Date(), 'yyyy-MM-dd'), time: '09:00', notes: '' });
        setIsNewClient(true);
        fetchInitialData();
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un error al guardar la cita.");
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE SERVICIOS ---
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingServiceId) {
        // Actualizar existente
        await supabase.from('services').update({
          title: serviceFormData.title,
          duration_min: Number(serviceFormData.duration_min),
          price: Number(serviceFormData.price)
        }).eq('id', editingServiceId);
      } else {
        // Crear nuevo
        await supabase.from('services').insert([{
          title: serviceFormData.title,
          duration_min: Number(serviceFormData.duration_min),
          price: Number(serviceFormData.price),
          active: true
        }]);
      }
      setEditingServiceId(null);
      setServiceFormData({ title: '', duration_min: 60, price: '' });
      fetchInitialData();
    } catch (error) {
      console.error(error);
      alert("Error al guardar el servicio.");
    } finally {
      setLoading(false);
    }
  };

  const toggleServiceStatus = async (id: string, currentStatus: boolean) => {
    try {
      await supabase.from('services').update({ active: !currentStatus }).eq('id', id);
      fetchInitialData();
    } catch (error) {
      console.error(error);
    }
  };

  const editService = (service: any) => {
    setEditingServiceId(service.id);
    setServiceFormData({
      title: service.title,
      duration_min: service.duration_min,
      price: service.price
    });
  };

  const resetServiceForm = () => {
    setEditingServiceId(null);
    setServiceFormData({ title: '', duration_min: 60, price: '' });
  };

  const handleSelectEvent = (event: any) => {
    setSelectedEvent(event);
  };

  return (
    <div className="min-h-screen bg-[#FFF9FB] font-sans text-slate-800">
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-md border-b border-pink-100/50 px-4 md:px-6 py-3 sticky top-0 z-30 flex flex-wrap justify-between items-center shadow-sm gap-4">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="relative w-40 h-10 md:w-56 md:h-12">
            <Image src="/logo-jennifer3.svg" alt="Jennifer Nails" fill className="object-contain object-left" priority />
          </div>
          <div className="hidden md:block h-8 w-[1.5px] bg-pink-100" />
          <div className="hidden md:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] leading-tight">
              La Unión, Valle 🍇 <span className="text-pink-300 mx-1">|</span> Capital Vitivinícola
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 ml-auto">
          <a
            href="https://www.instagram.com/yeniferrr"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 md:p-2.5 text-pink-400 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-all"
            title="Ver en Instagram"
            aria-label="Instagram de Jennifer Nails"
          >
            <Instagram size={20} />
          </a>
          <button
            onClick={() => setIsClientsModalOpen(true)}
            className="flex items-center gap-2 text-pink-500 bg-pink-50/50 hover:bg-pink-100 px-3 md:px-5 py-2 md:py-2.5 rounded-xl font-bold transition-all text-sm border border-pink-100/50"
          >
            <Users size={18} />
            <span className="hidden sm:inline">Clientes</span>
          </button>
          <button
            onClick={() => setIsServicesModalOpen(true)}
            className="flex items-center gap-2 text-[#D4AF37] bg-yellow-50/50 hover:bg-yellow-100 px-3 md:px-5 py-2 md:py-2.5 rounded-xl font-bold transition-all text-sm border border-yellow-100/50"
          >
            <Settings size={18} />
            <span className="hidden md:inline">Servicios</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:shadow-gold-200/50 hover:shadow-xl text-white px-4 md:px-7 py-2 md:py-2.5 rounded-xl font-bold transition-all transform active:scale-95 text-sm whitespace-nowrap"
          >
            + <span className="hidden sm:inline">Nueva Cita</span>
          </button>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL CALENDARIO */}
      <main className="p-2 md:p-8 max-w-[1440px] mx-auto h-[calc(100vh-80px)]">
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_20px_50px_rgba(255,192,203,0.15)] overflow-hidden h-full border border-white flex flex-col">
          <div className="flex-1 overflow-x-auto min-h-0">
             <div className="min-w-[800px] h-full modern-calendar-container">
               <Calendar 
                 localizer={localizer} 
                 events={events} 
                 culture="es" 
                 onSelectEvent={handleSelectEvent}
                 messages={{ today: "Hoy", next: "Sig.", previous: "Ant.", month: "Mes", week: "Semana", day: "Día", agenda: "Lista" }} 
                 className="modern-calendar" 
               />
             </div>
          </div>
        </div>
      </main>

      {/* BOTÓN WHATSAPP */}
      <a href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer" className="fixed bottom-6 right-6 md:bottom-10 md:right-10 bg-[#25D366] text-white p-3 md:p-4 rounded-full md:rounded-2xl shadow-2xl hover:scale-110 active:scale-90 transition-all z-40 group">
        <MessageCircle size={28} />
      </a>

      {/* =========================================
          MODAL 1: AGENDAR CITA
      ========================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 w-full max-w-md shadow-2xl border-t-[8px] md:border-t-[10px] border-[#D4AF37] max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-6 italic">Agendar Belleza ✨</h2>
            <form onSubmit={handleSaveAppointment} className="space-y-4">

              <input required type="tel" className="w-full bg-pink-50/30 border-2 border-pink-50 rounded-2xl p-3 md:p-4 text-sm md:text-base focus:border-[#D4AF37] focus:bg-white outline-none transition-all" placeholder="Teléfono / WhatsApp" value={formData.clientPhone} onChange={e => checkClient(e.target.value)} />

              <input required className={`w-full border-2 rounded-2xl p-3 md:p-4 text-sm md:text-base outline-none transition-all ${!isNewClient ? 'bg-slate-50 border-transparent text-slate-500 cursor-not-allowed' : 'bg-pink-50/30 border-pink-50 focus:border-[#D4AF37] focus:bg-white'}`} placeholder="Nombre de la clienta" value={formData.clientName} readOnly={!isNewClient} onChange={e => setFormData({ ...formData, clientName: e.target.value })} />

              {/* Mostrar solo servicios activos en el dropdown */}
              <select required className="w-full bg-pink-50/30 border-2 border-pink-50 rounded-2xl p-3 md:p-4 text-sm md:text-base focus:border-[#D4AF37] focus:bg-white outline-none transition-all appearance-none text-slate-600 font-medium" value={formData.serviceId} onChange={e => setFormData({ ...formData, serviceId: e.target.value })}>
                <option value="">Selecciona un servicio...</option>
                {services.filter(s => s.active).map(s => (
                  <option key={s.id} value={s.id}>{s.title} ({s.duration_min} min)</option>
                ))}
              </select>

              <div className="flex gap-3">
                <input type="date" className="flex-1 bg-slate-50 rounded-2xl p-3 md:p-4 text-sm md:text-base outline-none border border-slate-100" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                <input type="time" className="w-[110px] md:w-32 bg-slate-50 rounded-2xl p-3 md:p-4 text-sm md:text-base outline-none border border-slate-100" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
              </div>

              <textarea className="w-full bg-pink-50/30 border-2 border-pink-50 rounded-2xl p-3 md:p-4 text-sm md:text-base focus:border-[#D4AF37] focus:bg-white outline-none transition-all min-h-[80px]" placeholder="Notas adicionales (opcional)..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />

              <button disabled={loading} className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white py-3.5 md:py-4 rounded-2xl font-bold text-base md:text-lg shadow-lg hover:brightness-110 transition-all">
                {loading ? 'Procesando...' : 'Confirmar Cita'}
              </button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="w-full text-slate-400 font-bold text-sm mt-2 p-2 hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL 2: GESTIÓN DE SERVICIOS
      ========================================= */}
      {isServicesModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 w-full max-w-2xl shadow-2xl border-t-[8px] md:border-t-[10px] border-pink-400 h-[auto] max-h-[90vh] overflow-y-auto scrollbar-hide flex flex-col md:flex-row gap-6 md:gap-8 relative">

            {/* HEADER MÓVIL (Botón de cerrar visible) */}
            <div className="flex justify-between items-center w-full md:hidden mb-2">
                 <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                   <Scissors className="text-pink-400" /> Catálogo
                 </h2>
                 <button onClick={() => { setIsServicesModalOpen(false); resetServiceForm(); }} className="text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-full w-10 h-10 flex items-center justify-center font-bold">✕</button>
            </div>

            {/* Formulario Crear/Editar Servicio */}
            <div className="flex-1 space-y-4">
              <h2 className="hidden md:flex text-2xl font-black text-slate-800 mb-6 items-center gap-2">
                <Scissors className="text-pink-400" /> Catálogo
              </h2>

              <form onSubmit={handleSaveService} className="space-y-4 bg-slate-50 p-5 md:p-6 rounded-[1.5rem] border border-slate-100">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1 block">Nombre del Servicio</label>
                  <input required className="w-full bg-white border border-slate-200 rounded-xl p-3 md:p-3 text-sm focus:border-pink-400 outline-none transition-all mt-1" placeholder="Ej. Semipermanente" value={serviceFormData.title} onChange={e => setServiceFormData({ ...serviceFormData, title: e.target.value })} />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 block">Minutos</label>
                    <input required type="number" min="15" step="15" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:border-pink-400 outline-none mt-1" value={serviceFormData.duration_min} onChange={e => setServiceFormData({ ...serviceFormData, duration_min: Number(e.target.value) })} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 block">Precio ($)</label>
                    <input required type="number" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:border-pink-400 outline-none mt-1" placeholder="Ej. 45000" value={serviceFormData.price} onChange={e => setServiceFormData({ ...serviceFormData, price: e.target.value })} />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button disabled={loading} className="flex-1 w-full sm:w-auto bg-pink-500 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-pink-600 transition-all flex justify-center items-center gap-2">
                    {editingServiceId ? <Edit2 size={16} /> : <Plus size={16} />}
                    {editingServiceId ? 'Actualizar' : 'Añadir'}
                  </button>
                  {editingServiceId && (
                    <button type="button" onClick={resetServiceForm} className="w-full sm:w-auto px-4 py-3 text-slate-500 font-bold text-sm bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors">
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Lista de Servicios Existentes */}
            <div className="flex-1 mt-6 md:mt-0">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-slate-400 uppercase">Servicios Guardados</h3>
                <button onClick={() => { setIsServicesModalOpen(false); resetServiceForm(); }} className="hidden md:flex text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 items-center justify-center transition-colors">✕</button>
              </div>

              <div className="space-y-3 max-h-[250px] md:max-h-[350px] overflow-y-auto scrollbar-hide pr-1">
                {services.map(s => (
                  <div key={s.id} className={`p-3 md:p-4 rounded-2xl border flex justify-between items-center transition-all ${s.active ? 'bg-white border-pink-100 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}>
                    <div>
                      <p className={`font-bold text-sm md:text-base ${s.active ? 'text-slate-700' : 'text-slate-400'}`}>{s.title}</p>
                      <p className="text-xs text-slate-400 font-medium">{s.duration_min} min • ${s.price}</p>
                    </div>
                    <div className="flex gap-1 md:gap-2">
                      <button onClick={() => editService(s)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => toggleServiceStatus(s.id, s.active)} className={`p-2 rounded-lg transition-colors ${s.active ? 'text-pink-400 hover:bg-pink-50' : 'text-slate-400 hover:bg-slate-200'}`} title={s.active ? "Desactivar" : "Activar"}>
                        {s.active ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </div>
                ))}
                {services.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4 italic">No hay servicios registrados.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================
          MODAL 3: GESTIÓN DE CLIENTES
      ========================================= */}
      {isClientsModalOpen && (
        <ManageClientsModal onClose={() => setIsClientsModalOpen(false)} />
      )}

      {/* =========================================
          MODAL 4: DETALLES DE CITA SELECCIONADA
      ========================================= */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-sm shadow-2xl relative border-t-[8px] border-pink-400">
               <button onClick={() => setSelectedEvent(null)} className="absolute top-4 right-4 text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors">
                 <X size={20} />
               </button>
               <h3 className="text-xl font-black text-slate-800 mb-4 pr-6">Detalles de Cita</h3>
               
               <div className="space-y-4">
                 <div className="bg-pink-50/50 p-4 rounded-xl border border-pink-100">
                   <p className="text-xs text-pink-400 font-bold uppercase mb-1">Clienta</p>
                   <p className="text-slate-700 font-bold text-lg">{selectedEvent.clientName || 'Sin Nombre'}</p>
                   {selectedEvent.clientPhone && (
                     <p className="text-sm text-slate-500 font-mono mt-1">{selectedEvent.clientPhone}</p>
                   )}
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                   <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                     <p className="text-xs text-slate-400 font-bold uppercase mb-1">Fecha</p>
                     <p className="text-slate-700 font-medium text-sm">{format(selectedEvent.start, 'dd MMM yyyy', {locale: es})}</p>
                   </div>
                   <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                     <p className="text-xs text-slate-400 font-bold uppercase mb-1">Hora</p>
                     <p className="text-slate-700 font-medium text-sm">{format(selectedEvent.start, 'h:mm a')} - {format(selectedEvent.end, 'h:mm a')}</p>
                   </div>
                 </div>

                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                   <p className="text-xs text-slate-400 font-bold uppercase mb-1">Servicio</p>
                   <p className="text-slate-700 font-bold">{selectedEvent.serviceTitle || 'General'}</p>
                 </div>

                 {selectedEvent.notes && (
                   <div className="bg-yellow-50/50 p-4 rounded-xl border border-yellow-100">
                     <p className="text-xs text-yellow-600 font-bold uppercase mb-1">Notas</p>
                     <p className="text-slate-600 text-sm whitespace-pre-wrap">{selectedEvent.notes}</p>
                   </div>
                 )}
               </div>

               <button onClick={() => setSelectedEvent(null)} className="w-full mt-6 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors">Cerrar</button>
            </div>
        </div>
      )}

      {/* ESTILOS GLOBALES (Intactos) */}
      <style jsx global>{`
        .modern-calendar-container {
          min-height: calc(100vh - 160px);
        }
        .modern-calendar { padding: 15px; border: none !important; min-height: 600px; height: 100%; }
        @media (min-width: 768px) {
           .modern-calendar { padding: 25px; }
        }
        .rbc-header { border-bottom: 2px solid #FFF1F2 !important; padding: 10px !important; font-weight: 700 !important; color: #D4AF37 !important; text-transform: uppercase; letter-spacing: 1px; font-size: 0.75rem; }
        .rbc-month-view, .rbc-time-view { border: none !important; }
        .rbc-day-bg { border-left: 1px solid #FFF1F2 !important; }
        .rbc-day-bg:first-child { border-left: none !important; }
        .rbc-month-row { border-top: 1px solid #FFF1F2 !important; }
        .rbc-event { background: #FFF1F2 !important; color: #BE185D !important; border: none !important; border-left: 4px solid #F472B6 !important; padding: 4px 8px !important; border-radius: 6px !important; font-weight: 700 !important; font-size: 0.75rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        @media (min-width: 768px) {
          .rbc-event { padding: 5px 10px !important; border-radius: 8px !important; font-size: 0.8rem; }
        }
        .rbc-today { background: #FFF9FB !important; }
        .rbc-off-range-bg { background: #FAFAFA !important; opacity: 0.4; }
        .rbc-toolbar { margin-bottom: 20px !important; flex-wrap: wrap; gap: 10px; justify-content: center; }
        @media (min-width: 768px) {
           .rbc-toolbar { margin-bottom: 30px !important; justify-content: space-between; }
        }
        .rbc-toolbar button { border: 1px solid #FFF1F2 !important; color: #64748b !important; font-weight: 700 !important; padding: 8px 16px !important; border-radius: 12px !important; transition: all 0.2s; background: white; font-size: 0.8rem; }
        @media (min-width: 768px) {
          .rbc-toolbar button { padding: 10px 22px !important; border-radius: 14px !important; font-size: 1rem; }
        }
        .rbc-toolbar button:hover { background: #FFF1F2 !important; color: #D4AF37 !important; }
        .rbc-toolbar button.rbc-active { background: #D4AF37 !important; color: white !important; border-color: #D4AF37 !important; box-shadow: 0 4px 15px rgba(212,175,55,0.3); }
        .rbc-toolbar-label { font-weight: 900 !important; font-size: 1.1rem !important; color: #1e293b !important; text-transform: capitalize; width: 100%; text-align: center; margin: 10px 0; }
        @media (min-width: 768px) {
          .rbc-toolbar-label { font-size: 1.4rem !important; width: auto; margin: 0; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}