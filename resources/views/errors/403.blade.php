@extends('errors.layout')

@section('code', '403')
@section('title', 'Akses tidak diizinkan')
@section('message', 'Anda tidak memiliki izin untuk mengakses halaman atau tindakan ini. Hubungi pemilik bisnis jika Anda memerlukan akses.')
@section('actions')
    <a href="/" class="btn btn-primary">Kembali ke Beranda</a>
    <a href="/dashboard" class="btn btn-outline">Buka Dashboard</a>
@endsection
