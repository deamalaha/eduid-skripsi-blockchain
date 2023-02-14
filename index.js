const express = require('express')
const app = express()
const mongoose = require('mongoose')
const web3 = require('web3');
var methodOverride = require('method-override')
var expressLayouts = require('express-ejs-layouts')
const { body, validationResult, check } = require('express-validator')
require('./utils/db.js')
var moment = require('moment')

const { Admins } = require('./utils/model/admin')
const { KurikulumJurusan } = require('./utils/model/kurikulumJurusan')
const { DataKelas } = require('./utils/model/dataKelas')
const { Siswa } = require('./utils/model/siswa')
const { NilaiSiswa } = require('./utils/model/nilaiSiswa')

const port = 4000

// setup
app.set('view engine','ejs')
app.use(express.static('public'))
app.use(expressLayouts)
app.use(express.urlencoded({extended: true}))
app.use(methodOverride('_method'))

app.get('/', (req, res) => {
  res.render('signup/login', {
    title: 'Login',
    layout: 'layout/modal-layout',
  })
})

//Login
app.post('/login', check('email', 'Email tidak valid').isEmail(), async (req, res) => {
  const error = validationResult(req)
  const {email, password } = req.body

  const user = await Admins.findOne({ email : email })

  if(!error.isEmpty()) {
    return res.status(400).json({ error: error.array() })
  }

  if(!user) {
    return res.status(401).json({
      status: 'FAIL',
      data: {
        name: 'UNAUTHORIZED',
        message: 'Email tidak terdaftar'
      }
    })
  }

  if (password != user.password) {
    return res.status(401).json({
      status: 'FAIL',
      data: {
        name: 'UNAUTHORIZED',
        message: 'Wrong password',
      },
    });
  }

  return res.redirect('/main/' + user._id)  
})

// Sign Up
app.get('/signup', (req, res) => {
  res.render('signup/sign-up', {
    title: 'Daftar',
    layout: 'layout/modal-layout',
  })
})

app.get('/signup_next', (req, res) => {
  res.render('signup/sign-up_next', {
    title: 'Daftar',
    layout: 'layout/modal-layout',
  })
})

app.post('/signup', check('email', 'Email tidak valid').isEmail(), async (req, res) => {
  const { email, password, name, nip, date, jabatan, noHp } = req.body

  const existingEmail = await Admins.findOne({ email : email })

  if(existingEmail) {
    return res.status(401).json({
      status: 'FAIL',
      data: {
        name: 'UNAUTHORIZED',
        message: 'Email telah terdaftar'
      },
    })
  }

  const newAdmin = Admins.insertMany({
    name,
    date,
    nip,
    noHp,
    email,
    password,
    jabatan
  })

  return res.redirect('/main/' + newAdmin._id)
})

// Main dashboard
app.get('/main/:_id', async (req, res) => {
  const admin = await Admins.findById({ _id: req.params._id})
  
  res.render('dashboard/main_dashboard', {
    title: 'Halaman Utama',
    layout: 'layout/main-layout',
    admin
  })
})

// Siswa Dashboard
app.get('/siswa/:_id', async (req, res) => {
  const admin = await Admins.findById({ _id: req.params._id}).populate({path:'kelas', populate:{path:'jurusan'}})

  res.render('dashboard/siswa_dashboard', {
    title: 'Siswa Dashboard',
    layout: 'layout/main-layout',
    admin,
    moment
  })

})

// Tambah Kelas Modal
app.get('/siswa/:_id/tambah_kelas', async (req, res) => {
  const jurusan = await KurikulumJurusan.find()
  const admin = await Admins.findById({ _id: req.params._id })
  
  res.render('modal/modal_tambah_kelas', {
    title: 'Siswa Dashboard - Tambah Kelas',
    layout: 'layout/modal-layout',
    admin,
    jurusan
  })
})


// Tambah Kelas Function
app.post('/siswa', body(), async (req, res) => {
  const { nama, kurikulumJurusan, adminId} = req.body
  
  const admin = await Admins.findById({ _id: req.body.adminId })
  const jurusan = await KurikulumJurusan.findOne({ _id: kurikulumJurusan})
  
  const newKelas = await DataKelas.create({
    nama,
    jurusan: kurikulumJurusan
  })

  jurusan.kelas.push(newKelas)
  jurusan.save() 

  admin.kelas.push(newKelas)
  admin.save()

  return res.redirect('/siswa/' + adminId)
})

// Delete Kelas Function
app.delete('/siswa/hapusKelas', (req, res) => {
  DataKelas.deleteOne({ _id : req.body.kelasId}).then((result) => {
    res.redirect('/siswa/' + req.body.adminId)
  })
})

// Edit Siswa Modal
app.get('/siswa/:adminId/:kelasId/:siswaId/edit', async (req, res) => {
  const admin = await Admins.findOne({_id: req.params.adminId})
  const siswa = await Siswa.findOne({ _id : req.params.siswaId})
  const dataKelas = await DataKelas.findOne({ _id : req.params.kelasId})
  
  res.render('modal/modal_edit_siswa', {
    title: 'Siswa Dashboard - Edit Siswa',
    layout: 'layout/main-layout',
    siswa,
    admin,
    dataKelas
  })
})

// Edit Siswa Function
app.put('/siswa/editSiswa', body(), async (req, res) => {
  const { namaSiswa, nisn, siswaId, adminId, kelasId } = req.body

  await Siswa.findByIdAndUpdate(
    { _id: siswaId},
    { 
      namaSiswa, nisn
    }
  ).then((result) => {
    res.redirect('/siswa/' + adminId + '/' + kelasId)
  })
})


// Edit Kelas Modal
app.get('/siswa/:adminId/edit/:kelasId', async (req, res) => {
  const admin = await Admins.findOne({_id: req.params.adminId})
  const dataKelas = await DataKelas.findOne({ _id : req.params.kelasId});
  const jurusan = await KurikulumJurusan.find()

  res.render('modal/modal_edit_kelas', {
    title: 'Siswa Dashboard - Edit Kelas',
    layout: 'layout/modal-layout',
    dataKelas,
    admin,
    jurusan
  })
})

// Edit Kelas Function
app.put('/siswa/editKelas', async (req, res) => {
  const { nama, kurikulumJurusan, adminId, kelasId } = req.body

    await DataKelas.findOneAndUpdate(
      { _id : kelasId }, 
      {
          nama,
          jurusan: kurikulumJurusan,
      }
    ).then((result) => {
      res.redirect('/siswa/' + adminId)
    })
  }
)

// Tambah Siswa Modal
app.get('/siswa/:adminId/tambah_siswa/:kelasId', async (req, res) => {
  const admin = await Admins.findOne({_id: req.params.adminId})
  const dataKelas = await DataKelas.findOne({ _id: req.params.kelasId })
  
  res.render('modal/modal_tambah_siswa', {
    title: 'modal/modal_tambah_siswa',
    layout: 'layout/modal-layout',
    dataKelas,
    admin
  })
})

// Tambah Siswa Function
app.post('/siswa/tambah_siswa', body(), async (req, res) => {
  const dataKelas = await DataKelas.findOne({ _id: req.body.kelasId })
  var a = [{namaSiswa:'aa' ,nisn :'vv' }, {namaSiswa:'aa' ,nisn :'vv' } , {namaSiswa:'aa' ,nisn :'vv' }]
  
  const { namaSiswa, nisn } = req.body
  
  const newSiswa = await Siswa.create({
    namaSiswa,
    nisn,
    kelas: req.body.kelasId
  })

  dataKelas.siswa.push(newSiswa)
  dataKelas.save()
  

  return res.redirect('/siswa/' + req.body.adminId + '/' + req.body.kelasId)
})

// Siswa Dashboard - Tambah Siswa
app.get('/siswa/:adminId/:kelasId', async (req, res) => {
  const admin = await Admins.findOne({_id: req.params.adminId})
  const dataKelas = await DataKelas.findOne({ _id : req.params.kelasId}).populate('siswa jurusan')
  var a = [{namaSiswa:'aa' ,nisn :'vv' }, {namaSiswa:'aa' ,nisn :'vv' } , {namaSiswa:'aa' ,nisn :'vv' }]

  res.render('add/tambah_siswa', {
    title: 'Siswa Dashboard - Tambah Siswa',
    layout: 'layout/main-layout',
    dataKelas,
    admin,
    a,
    moment
  })
  
})

// Hapus Siswa Function
app.delete('/siswa/hapusSiswa', (req, res) => {
  Siswa.deleteOne({ _id : req.body.siswaId}).then((result) => {
    res.redirect('/siswa/' + req.body.adminId + '/' + req.body.kelasId)
  })
})

// Tambah Nilai Siswa Dashboard
app.get('/siswa/:adminId/:kelasId/:siswaId', async (req, res) => {
  const admin = await Admins.findOne({_id: req.params.adminId})
  const dataKelas = await DataKelas.findOne({_id: req.params.kelasId})
  const siswa = await Siswa.findOne({_id: req.params.siswaId})
  const mataPelajaran = await DataKelas.findById({_id: req.params.kelasId}).populate({path:'jurusan', populate:{path:'mataPelajaran'}})

  const nilaiSiswa = await NilaiSiswa.find()
  
  const listNilai = await Siswa.findById({_id: req.params.siswaId}).populate({path: 'nilai'})
  
  res.render('add/tambah_nilaiSiswa', {
    title: 'Siswa Dashboard - Tambah Nilai',
    layout: 'layout/main-layout',
    admin,
    dataKelas,
    siswa,
    mataPelajaran,
    nilaiSiswa,
    listNilai,
    moment
  })

})

//Tambah Nilai Modal
app.get('/siswa/:adminId/:kelasId/:siswaId/:matpelId/tambahNilai', async (req, res) => {
  const admin = await Admins.findOne({_id: req.params.adminId})
  const dataKelas = await DataKelas.findOne({_id: req.params.kelasId})
  const siswa = await Siswa.findOne({_id: req.params.siswaId})
  const mataPelajaran = await DataKelas.findById({_id: req.params.kelasId}).populate({path: 'jurusan', populate:{path:'mataPelajaran'}})
  const selectedMatPel = await mataPelajaran.jurusan.mataPelajaran.find(item => item._id.toString() === req.params.matpelId)

  res.render('modal/modal_tambah_nilai_siswa', {
    title: 'Siswa Dashboard - Tambah Nilai',
    layout: 'layout/main-layout',
    admin,
    dataKelas,
    siswa,
    mataPelajaran,
    selectedMatPel
  })
})

// Tambah Nilai Function
app.post('/siswa/tambahNilai', async (req, res) => {
  const siswa = await Siswa.findOne({_id: req.body.siswaId})
  const dataKelas = await DataKelas.findOne({_id: req.body.kelasId})

  const newNilai = await NilaiSiswa.create({
    siswa,
    nilai: req.body.nilai,
    mataPelajaran: req.body.matpelId,
    kelas: dataKelas
  })

  siswa.nilai.push(newNilai)
  siswa.save()

  return res.redirect('/siswa/' + req.body.adminId + '/' + req.body.kelasId + '/' + req.body.siswaId)
})

// Edit Nilai Siswa Modal
app.get('/siswa/:adminId/:kelasId/:siswaId/:matpelId/:matpelNilaiId/editNilai', async (req, res) => {
  const admin = await Admins.findOne({_id: req.params.adminId})
  const siswa = await Siswa.findOne({ _id : req.params.siswaId})
  const dataKelas = await DataKelas.findOne({ _id : req.params.kelasId})
  const mataPelajaran = await DataKelas.findById({_id: req.params.kelasId}).populate({path: 'jurusan', populate:{path:'mataPelajaran'}})
  const selectedMatPel = await mataPelajaran.jurusan.mataPelajaran.find(item => item._id.toString() === req.params.matpelId)
  const matpelNilai = await NilaiSiswa.findOne({_id : req.params.matpelNilaiId})
  
  res.render('modal/modal_edit_nilai_siswa', {
    title: 'Siswa Dashboard - Edit Nilai Siswa',
    layout: 'layout/main-layout',
    siswa,
    admin,
    dataKelas,
    selectedMatPel,
    matpelNilai
  })
})

// Edit Nilai Siswa Function
app.put('/siswa/editNilai', body(), async (req, res) => {
  const { siswaId, adminId, kelasId, nilaiId, nilai } = req.body

  await NilaiSiswa.findByIdAndUpdate(
    { _id: nilaiId},
    { 
      nilai
    }
  ).then((result) => {
    res.redirect('/siswa/' + adminId + '/' + kelasId + '/' + siswaId)
  })
})

// Kurikulum Dashboard
app.get('/kurikulum/:_id', async (req, res) => {
  const admin = await Admins.findOne({_id: req.params._id})
  const dataKurikulum = await KurikulumJurusan.find()
  
  res.render('dashboard/kurikulum_dashboard', {
    title: 'Kurikulum Dashboard',
    layout: 'layout/main-layout',
    dataKurikulum,
    admin,
    moment
  })
})

// Tambah Jurusan Modal
app.get('/kurikulum/:_id/tambah_jurusan', async (req, res) => {
  const admin = await Admins.findOne({_id: req.params._id})

  res.render('modal/modal_tambah_jurusan', {
    title: 'Kurikulum Dashboard - Tambah Jurusan',
    layout: 'layout/modal-layout',
    admin
  })
})

// Edit Jurusan Modal
app.get('/kurikulum/:adminId/edit/:jurusanId', async (req, res) => {
  const admin = await Admins.findOne({_id: req.params.adminId})
  const dataJurusan = await KurikulumJurusan.findOne({ _id : req.params.jurusanId});

  res.render('modal/modal_edit_jurusan', {
    title: 'Kurikulum Dashboard - Edit Jurusan',
    layout: 'layout/modal-layout',
    dataJurusan,
    admin
  })
})

// Tambah Jurusan Function
app.post('/kurikulum', body(), async (req, res) => {
  const { jurusan, tingkatan, semester, standarKurikulum, skalaPenilaian, adminId } = req.body

  if(req.body.jurusan === 'MIPA') {
    const MIPAmatpel = [{
      namaMataPelajaran: 'Biologi',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Matematika',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Fisika',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Kimia',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Pendidikan Agama',
      kkm: '70',
      durasiJam: '32'
    }
    , {
      namaMataPelajaran: 'PPKN',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Matematika Wajib',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Sejarah Indonesia',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Bahasa Inggris',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Seni Budaya',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Pendidikan Olahraga',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Prakarya dan Kewirausahaan',
      kkm: '70',
      durasiJam: '32'
    }]

    await KurikulumJurusan.create({
      jurusan,
      tingkatan,
      semester,
      standarKurikulum,
      skalaPenilaian,
      mataPelajaran: MIPAmatpel
    })
  } else {
    const IPSmatpel = [{
      namaMataPelajaran: 'Geografi',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Sejarah',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Sosiologi',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Ekonomi',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Pendidikan Agama',
      kkm: '70',
      durasiJam: '32'
    }
    , {
      namaMataPelajaran: 'PPKN',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Matematika Wajib',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Sejarah Indonesia',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Bahasa Inggris',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Seni Budaya',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Pendidikan Olahraga',
      kkm: '70',
      durasiJam: '32'
    }, {
      namaMataPelajaran: 'Prakarya dan Kewirausahaan',
      kkm: '70',
      durasiJam: '32'
    }]

    await KurikulumJurusan.create({
      jurusan,
      tingkatan,
      semester,
      standarKurikulum,
      skalaPenilaian,
      mataPelajaran: IPSmatpel
    })
  }

  return res.redirect('/kurikulum/' + adminId)
})

// Delete Jurusan Function
app.delete('/kurikulum/hapusJurusan', (req, res) => {
  KurikulumJurusan.deleteOne({ _id : req.body.jurusanId}).then((result) => {
    res.redirect('/kurikulum/' + req.body.adminId)
  })
})

// Edit Jurusan Function
app.put('/kurikulum/editJurusan', body(), async (req, res) => {
  const { tingkatan, jurusan, semester, standarKurikulum, skalaPenilaian, jurusanId, adminId } = req.body

  await KurikulumJurusan.findByIdAndUpdate(
    { _id: jurusanId},
    { 
      tingkatan, jurusan, semester, standarKurikulum, skalaPenilaian
    }
  ).then((result) => {
    res.redirect('/kurikulum/' + adminId)
  })
})

app.get('/data_sharing/:_id', async (req, res) => {
  const admin = await Admins.findOne({_id: req.params._id})

  res.render('dashboard/data-sharing_dashboard', {
    title: 'Data Sharing',
    layout: 'layout/main-layout',
    admin
  })
})


app.listen(port, () => {
  console.log(`EduID listening on port https://localhost:${port}`)
})
