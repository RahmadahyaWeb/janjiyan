@extends('errors.layout')

@section('code', '419')
@section('title', 'Sesi halaman telah berakhir')
@section('message', 'Formulir sudah kedaluwarsa karena terlalu lama tidak aktif. Muat ulang halaman untuk melanjutkan.')
@section('actions')
    <button type="button" onclick="window.location.reload()" class="btn btn-primary">Muat Ulang Halaman</button>
    <a href="/login" class="btn btn-outline">Masuk Kembali</a>
@endsection
