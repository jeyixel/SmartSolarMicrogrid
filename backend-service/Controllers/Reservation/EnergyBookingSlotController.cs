using backend_service.Models;
using backend_service.Services;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace backend_service.Controllers;

[ApiController]
[Route("api/slots")]
public class EnergyBookingSlotController : ControllerBase
{
    private readonly IEnergyBookingSlotService _slotService;

    public EnergyBookingSlotController(IEnergyBookingSlotService slotService)
    {
        _slotService = slotService;
    }

    [HttpGet]
    public async Task<ActionResult<List<EnergyBookingSlot>>> GetAll()
    {
        var slots = await _slotService.GetAllSlotsAsync();
        return Ok(slots);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<EnergyBookingSlot>> Get(string id)
    {
        var slot = await _slotService.GetSlotByIdAsync(id);
        if (slot == null) return NotFound();
        return Ok(slot);
    }

    [HttpPost]
    public async Task<ActionResult<EnergyBookingSlot>> Create(EnergyBookingSlot slot)
    {
        var createdSlot = await _slotService.CreateSlotAsync(slot);
        return CreatedAtAction(nameof(Get), new { id = createdSlot.Id }, createdSlot);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, EnergyBookingSlot slot)
    {
        await _slotService.UpdateSlotAsync(id, slot);
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await _slotService.DeleteSlotAsync(id);
        return NoContent();
    }
}

