/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Data transfer object for paginated user list responses.
 * Last Modified: 2026-09-23
 */

namespace backend_service.DTOs;

public class PagedUsersResponseDto
{
    public List<UserResponseDto> Items { get; set; } = new();
    public long Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
