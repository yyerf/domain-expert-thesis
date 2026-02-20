<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserManagementController extends Controller
{
    /**
     * Show the create user page for admins.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('admin/users/create', [
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Store a new non-admin user account.
     */
    public function store(StoreUserRequest $request): RedirectResponse
    {
        User::query()->create([
            ...$request->validated(),
            'email_verified_at' => now(),
            'is_admin' => false,
        ]);

        return to_route('admin.users.create')->with('status', 'Account created successfully.');
    }
}
